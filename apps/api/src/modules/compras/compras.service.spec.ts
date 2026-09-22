import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ComprasService } from './compras.service.js';
import { COMPRAS_REPOSITORY, type CompraRecord, type ComprasRepository } from './compras.repository.js';

const compraBase: CompraRecord = {
  id: 'compra-1',
  empresaId: 'empresa-1',
  fecha: '2026-09-22',
  proveedorNombre: 'Distribuidora SRL',
  proveedorId: null,
  ordenCompraId: null,
  total: 1000,
  notas: null,
  anulada: false,
  costoFlete: 0,
  costoImpuestos: 0,
  costoOtros: 0,
  descripcionOtros: null,
  totalCostosAdicionales: 0,
  totalReal: 1000,
  imagenFacturaUrl: null,
};

const itemBase = { productoId: 'prod-1', productoNombre: 'Yerba', cantidad: 10, costoUnitario: 100 };

describe('ComprasService', () => {
  let service: ComprasService;
  let repository: { [K in keyof ComprasRepository]: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    repository = {
      listar: vi.fn(),
      ficha: vi.fn(),
      confirmar: vi.fn(),
      anular: vi.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [ComprasService, { provide: COMPRAS_REPOSITORY, useValue: repository }],
    }).compile();
    service = module.get(ComprasService);
  });

  it('confirmar() devuelve la compra cuando el repositorio confirma', async () => {
    repository.confirmar.mockResolvedValue({ ok: true, compra: compraBase });
    const resultado = await service.confirmar('empresa-1', 'user-1', {
      fecha: '2026-09-22',
      items: [itemBase],
    });
    expect(resultado).toEqual(compraBase);
  });

  it.each(['sin_productos', 'producto_invalido', 'variante_invalida', 'proveedor_invalido', 'ubicacion_invalida'] as const)(
    'confirmar() lanza BadRequestException cuando el repositorio rechaza con motivo %s',
    async (motivo) => {
      repository.confirmar.mockResolvedValue({ ok: false, motivo });
      await expect(
        service.confirmar('empresa-1', 'user-1', { fecha: '2026-09-22', items: [itemBase] }),
      ).rejects.toThrow(BadRequestException);
    },
  );

  it('ficha() lanza NotFoundException cuando la compra no existe en esa empresa', async () => {
    repository.ficha.mockResolvedValue(null);
    await expect(service.ficha('empresa-1', 'compra-x')).rejects.toThrow(NotFoundException);
  });

  it('anular() lanza NotFoundException cuando la compra no existe', async () => {
    repository.anular.mockResolvedValue('no_encontrada');
    await expect(
      service.anular('empresa-1', 'user-1', 'compra-x', { motivo: 'Error de carga' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('anular() lanza BadRequestException cuando ya estaba anulada', async () => {
    repository.anular.mockResolvedValue('ya_anulada');
    await expect(
      service.anular('empresa-1', 'user-1', 'compra-1', { motivo: 'Error de carga' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('anular() no lanza cuando el repositorio confirma la anulación', async () => {
    repository.anular.mockResolvedValue('ok');
    await expect(
      service.anular('empresa-1', 'user-1', 'compra-1', { motivo: 'Error de carga' }),
    ).resolves.toBeUndefined();
  });
});

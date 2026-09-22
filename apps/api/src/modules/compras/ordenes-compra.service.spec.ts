import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OrdenesCompraService } from './ordenes-compra.service.js';
import {
  ORDENES_COMPRA_REPOSITORY,
  type OrdenCompraFicha,
  type OrdenCompraRecord,
  type OrdenesCompraRepository,
} from './ordenes-compra.repository.js';

const ordenBase: OrdenCompraRecord = {
  id: 'oc-1',
  empresaId: 'empresa-1',
  numeroOc: 'OC-1',
  proveedorId: null,
  proveedorNombre: null,
  estado: 'borrador',
  fechaEmision: '2026-09-22',
  fechaEntregaEstimada: null,
  notas: null,
  total: 1000,
};

const fichaBase: OrdenCompraFicha = {
  ...ordenBase,
  items: [],
  proveedorContacto: null,
  proveedorCuit: null,
};

const itemBase = { productoId: 'prod-1', varianteId: null, cantidadPedida: 5, precioUnitario: 200 };

describe('OrdenesCompraService', () => {
  let service: OrdenesCompraService;
  let repository: { [K in keyof OrdenesCompraRepository]: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    repository = {
      listar: vi.fn(),
      ficha: vi.fn(),
      crear: vi.fn(),
      actualizar: vi.fn(),
      actualizarEstado: vi.fn(),
      registrarRecepcion: vi.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [OrdenesCompraService, { provide: ORDENES_COMPRA_REPOSITORY, useValue: repository }],
    }).compile();
    service = module.get(OrdenesCompraService);
  });

  it('crear() devuelve la ficha cuando el repositorio confirma', async () => {
    repository.crear.mockResolvedValue({ ok: true, orden: fichaBase });
    const resultado = await service.crear('empresa-1', { estado: 'borrador', items: [itemBase] });
    expect(resultado).toEqual(fichaBase);
  });

  it.each(['proveedor_invalido', 'producto_invalido', 'variante_invalida'] as const)(
    'crear() lanza BadRequestException cuando el repositorio rechaza con motivo %s',
    async (motivo) => {
      repository.crear.mockResolvedValue({ ok: false, motivo });
      await expect(
        service.crear('empresa-1', { estado: 'borrador', items: [itemBase] }),
      ).rejects.toThrow(BadRequestException);
    },
  );

  it('actualizar() lanza NotFoundException cuando la OC no existe en esa empresa', async () => {
    repository.actualizar.mockResolvedValue({ ok: false, motivo: 'no_encontrada' });
    await expect(
      service.actualizar('empresa-1', 'oc-x', { estado: 'borrador', items: [itemBase] }),
    ).rejects.toThrow(NotFoundException);
  });

  it('actualizarEstado() lanza NotFoundException cuando la OC no existe', async () => {
    repository.actualizarEstado.mockResolvedValue(null);
    await expect(service.actualizarEstado('empresa-1', 'oc-x', { estado: 'cancelada' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('registrarRecepcion() lanza NotFoundException cuando la OC no existe', async () => {
    repository.registrarRecepcion.mockResolvedValue({ ok: false, motivo: 'no_encontrada' });
    await expect(
      service.registrarRecepcion('empresa-1', 'user-1', 'oc-x', { cantidades: {} }),
    ).rejects.toThrow(NotFoundException);
  });

  it('registrarRecepcion() lanza BadRequestException cuando no hay cantidades válidas', async () => {
    repository.registrarRecepcion.mockResolvedValue({ ok: false, motivo: 'sin_cantidades' });
    await expect(
      service.registrarRecepcion('empresa-1', 'user-1', 'oc-1', { cantidades: {} }),
    ).rejects.toThrow(BadRequestException);
  });

  it('registrarRecepcion() devuelve la ficha actualizada cuando el repositorio confirma', async () => {
    repository.registrarRecepcion.mockResolvedValue({ ok: true, orden: fichaBase });
    const resultado = await service.registrarRecepcion('empresa-1', 'user-1', 'oc-1', {
      cantidades: { 'item-1': 5 },
    });
    expect(resultado).toEqual(fichaBase);
  });
});

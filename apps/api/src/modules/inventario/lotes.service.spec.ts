import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { LotesService } from './lotes.service.js';
import { LOTES_REPOSITORY, type LoteRecord, type LotesRepository } from './lotes.repository.js';

const loteBase: LoteRecord = {
  id: 'lote-1',
  empresaId: 'empresa-1',
  productoId: 'prod-1',
  productoNombre: 'Yerba',
  varianteId: null,
  varianteEtiqueta: null,
  numeroLote: 'LOTE-202609-001',
  fechaVencimiento: null,
  fechaElaboracion: null,
  cantidadInicial: 10,
  stock: 10,
  proveedorId: null,
  proveedorNombre: null,
  notas: null,
  activo: true,
  estado: 'sin_vencimiento',
};

describe('LotesService', () => {
  let service: LotesService;
  let repository: { [K in keyof LotesRepository]: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    repository = {
      listarPorProducto: vi.fn(),
      crear: vi.fn(),
      sugerenciaNumero: vi.fn(),
      disponibles: vi.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [LotesService, { provide: LOTES_REPOSITORY, useValue: repository }],
    }).compile();
    service = module.get(LotesService);
  });

  it('listarPorProducto() lanza NotFoundException cuando el producto no existe', async () => {
    repository.listarPorProducto.mockResolvedValue(null);
    await expect(service.listarPorProducto('empresa-1', 'prod-x')).rejects.toThrow(NotFoundException);
  });

  it('crear() devuelve el lote creado cuando el repositorio lo confirma', async () => {
    repository.crear.mockResolvedValue(loteBase);
    const resultado = await service.crear('empresa-1', 'user-1', 'prod-1', {
      numeroLote: 'LOTE-202609-001',
      cantidadInicial: 10,
      registrarMovimiento: true,
    });
    expect(resultado).toEqual(loteBase);
  });

  it('crear() lanza NotFoundException cuando el producto no existe', async () => {
    repository.crear.mockResolvedValue(null);
    await expect(
      service.crear('empresa-1', 'user-1', 'prod-x', {
        numeroLote: 'L-1',
        cantidadInicial: 0,
        registrarMovimiento: true,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('sugerenciaNumero() arma el prefijo del mes y rellena el correlativo a 3 dígitos', async () => {
    repository.sugerenciaNumero.mockResolvedValue(7);
    const numero = await service.sugerenciaNumero('empresa-1');
    expect(numero).toMatch(/^LOTE-\d{6}-007$/);
  });
});

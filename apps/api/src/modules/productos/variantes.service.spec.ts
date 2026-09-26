import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { VariantesService } from './variantes.service.js';
import {
  RepartoStockError,
  SkuDuplicadoError,
  VARIANTES_REPOSITORY,
  type VarianteRecord,
  type VariantesRepository,
} from './variantes.repository.js';
import { SKU_REPOSITORY, type SkuRepository } from './sku.repository.js';

const varianteBase: VarianteRecord = {
  id: 'var-1',
  productoId: 'prod-1',
  empresaId: 'empresa-1',
  sku: 'PROD-ROJO-M',
  atributos: { Color: 'Rojo', Talle: 'M' },
  precioVenta: 100,
  costo: 60,
  activo: true,
};

describe('VariantesService', () => {
  let service: VariantesService;
  let repository: { [K in keyof VariantesRepository]: ReturnType<typeof vi.fn> };
  let skus: { [K in keyof SkuRepository]: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    repository = {
      listarPorProducto: vi.fn(),
      guardarVariantesProducto: vi.fn(),
      stockSinVariante: vi.fn(),
    };
    skus = { asignarFaltantes: vi.fn().mockResolvedValue(1), enUso: vi.fn(), buscarPorCodigo: vi.fn(), guardarSkuProducto: vi.fn() };
    const module = await Test.createTestingModule({
      providers: [VariantesService, { provide: VARIANTES_REPOSITORY, useValue: repository }, { provide: SKU_REPOSITORY, useValue: skus }],
    }).compile();
    service = module.get(VariantesService);
  });

  it('listarPorProducto() lanza NotFoundException cuando el repositorio devuelve null (producto ajeno o inexistente)', async () => {
    repository.listarPorProducto.mockResolvedValue(null);
    await expect(service.listarPorProducto('empresa-1', 'prod-x')).rejects.toThrow(NotFoundException);
  });

  it('guardar() normaliza campos opcionales a null y pasa usuario y reparto', async () => {
    repository.guardarVariantesProducto.mockResolvedValue([varianteBase]);
    const reparto = [{ atributos: { Color: 'Rojo' }, cantidad: 3 }];
    await service.guardar('empresa-1', 'user-1', 'prod-1', {
      variantes: [{ atributos: { Color: 'Rojo' }, activo: true }],
      repartoSinVariante: reparto,
    });
    expect(repository.guardarVariantesProducto).toHaveBeenCalledWith(
      'empresa-1',
      'prod-1',
      [{ id: undefined, sku: null, atributos: { Color: 'Rojo' }, precioVenta: null, costo: null, activo: true }],
      { usuarioId: 'user-1', reparto },
    );
    expect(skus.asignarFaltantes).not.toHaveBeenCalled();
  });

  it('guardar() genera el SKU de las variantes que quedaron sin uno', async () => {
    repository.guardarVariantesProducto.mockResolvedValue([{ ...varianteBase, sku: null }]);
    repository.listarPorProducto.mockResolvedValue([{ ...varianteBase, sku: 'GEN-PROD-ROJ-001' }]);
    const lista = await service.guardar('empresa-1', 'user-1', 'prod-1', { variantes: [{ atributos: { Color: 'Rojo' }, activo: true }] });
    expect(skus.asignarFaltantes).toHaveBeenCalledWith('empresa-1', 'prod-1');
    expect(lista[0].sku).toBe('GEN-PROD-ROJ-001');
  });

  it('guardar() pide el reparto del stock sin variante con 409', async () => {
    repository.guardarVariantesProducto.mockRejectedValue(new RepartoStockError('reparto_requerido', 12));
    const error = await service.guardar('empresa-1', 'user-1', 'prod-1', { variantes: [] }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({ codigo: 'reparto_requerido', stockSinVariante: 12 });
  });

  it('guardar() rechaza un SKU repetido', async () => {
    repository.guardarVariantesProducto.mockRejectedValue(new SkuDuplicadoError('MAT-001', 'Mate Imperial'));
    await expect(service.guardar('empresa-1', 'user-1', 'prod-1', { variantes: [] })).rejects.toThrow(BadRequestException);
  });

  it('guardar() lanza NotFoundException cuando el repositorio devuelve null', async () => {
    repository.guardarVariantesProducto.mockResolvedValue(null);
    await expect(service.guardar('empresa-1', 'user-1', 'prod-x', { variantes: [] })).rejects.toThrow(NotFoundException);
  });
});

import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { VariantesService } from './variantes.service.js';
import {
  VARIANTES_REPOSITORY,
  type VarianteRecord,
  type VariantesRepository,
} from './variantes.repository.js';

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

  beforeEach(async () => {
    repository = {
      listarPorProducto: vi.fn(),
      guardarVariantesProducto: vi.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [VariantesService, { provide: VARIANTES_REPOSITORY, useValue: repository }],
    }).compile();
    service = module.get(VariantesService);
  });

  it('listarPorProducto() lanza NotFoundException cuando el repositorio devuelve null (producto ajeno o inexistente)', async () => {
    repository.listarPorProducto.mockResolvedValue(null);
    await expect(service.listarPorProducto('empresa-1', 'prod-x')).rejects.toThrow(NotFoundException);
  });

  it('guardar() normaliza campos opcionales a null y delega al repositorio', async () => {
    repository.guardarVariantesProducto.mockResolvedValue([varianteBase]);
    await service.guardar('empresa-1', 'prod-1', {
      variantes: [{ atributos: { Color: 'Rojo' }, activo: true }],
    });
    expect(repository.guardarVariantesProducto).toHaveBeenCalledWith('empresa-1', 'prod-1', [
      { id: undefined, sku: null, atributos: { Color: 'Rojo' }, precioVenta: null, costo: null, activo: true },
    ]);
  });

  it('guardar() lanza NotFoundException cuando el repositorio devuelve null', async () => {
    repository.guardarVariantesProducto.mockResolvedValue(null);
    await expect(service.guardar('empresa-1', 'prod-x', { variantes: [] })).rejects.toThrow(
      NotFoundException,
    );
  });
});

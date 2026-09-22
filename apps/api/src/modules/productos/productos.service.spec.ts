import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ProductosService } from './productos.service.js';
import { PRODUCTOS_REPOSITORY, type ProductoRecord, type ProductosRepository } from './productos.repository.js';

const productoBase: ProductoRecord = {
  id: 'prod-1',
  empresaId: 'empresa-1',
  nombre: 'Yerba',
  categoriaId: null,
  categoriaNombre: null,
  codigoBarra: null,
  precioVenta: 100,
  costo: 60,
  activo: true,
  altoCm: null,
  largoCm: null,
  anchoCm: null,
  pesoGr: null,
};

describe('ProductosService', () => {
  let service: ProductosService;
  let repository: { [K in keyof ProductosRepository]: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    repository = {
      crear: vi.fn(),
      actualizar: vi.fn(),
      buscarPorId: vi.fn(),
      listar: vi.fn(),
      listarNombres: vi.fn(),
      guardarCodigoBarra: vi.fn(),
      guardarDimensiones: vi.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [ProductosService, { provide: PRODUCTOS_REPOSITORY, useValue: repository }],
    }).compile();
    service = module.get(ProductosService);
  });

  it('crear() normaliza campos opcionales a null y delega al repositorio', async () => {
    repository.crear.mockResolvedValue(productoBase);
    await service.crear('empresa-1', { nombre: 'Yerba', activo: true });
    expect(repository.crear).toHaveBeenCalledWith('empresa-1', {
      nombre: 'Yerba',
      categoriaId: null,
      precioVenta: null,
      costo: null,
      activo: true,
    });
  });

  it('actualizar() lanza NotFoundException cuando el repositorio devuelve null (empresa no dueña o no existe)', async () => {
    repository.actualizar.mockResolvedValue(null);
    await expect(
      service.actualizar('empresa-1', 'prod-x', { nombre: 'X', activo: true }),
    ).rejects.toThrow(NotFoundException);
  });

  it('buscarPorId() lanza NotFoundException cuando no existe', async () => {
    repository.buscarPorId.mockResolvedValue(null);
    await expect(service.buscarPorId('empresa-1', 'prod-x')).rejects.toThrow(NotFoundException);
  });

  it('guardarCodigoBarra() lanza NotFoundException cuando no existe', async () => {
    repository.guardarCodigoBarra.mockResolvedValue(null);
    await expect(service.guardarCodigoBarra('empresa-1', 'prod-x', '123')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('guardarDimensiones() lanza NotFoundException cuando no existe', async () => {
    repository.guardarDimensiones.mockResolvedValue(null);
    await expect(
      service.guardarDimensiones('empresa-1', 'prod-x', {
        altoCm: null,
        largoCm: null,
        anchoCm: null,
        pesoGr: null,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('listar() delega la query resuelta (con defaults ya aplicados por zod) al repositorio', async () => {
    repository.listar.mockResolvedValue({ items: [productoBase], total: 1, activos: 1 });
    const resultado = await service.listar('empresa-1', {
      pagina: 1,
      pageSize: 20,
      busqueda: '',
      estado: 'todos',
      margen: 'todos',
    });
    expect(repository.listar).toHaveBeenCalledWith('empresa-1', {
      busqueda: '',
      categoriaId: null,
      estado: 'todos',
      margen: 'todos',
      pagina: 1,
      pageSize: 20,
    });
    expect(resultado.total).toBe(1);
  });
});

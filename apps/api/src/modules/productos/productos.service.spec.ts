import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ProductosService } from './productos.service.js';
import { PRODUCTOS_REPOSITORY, type ProductoRecord, type ProductosRepository } from './productos.repository.js';
import { SKU_REPOSITORY, type SkuRepository } from './sku.repository.js';

const productoBase: ProductoRecord = {
  id: 'prod-1',
  empresaId: 'empresa-1',
  nombre: 'Yerba',
  oferta: null,
  categoriaId: null,
  categoriaNombre: null,
  codigoBarra: null,
  sku: 'GEN-YER-001',
  usaVariantes: false,
  esInsumo: false,
  unidad: 'unidad',
  enTienda: true,
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
  let skus: { [K in keyof SkuRepository]: ReturnType<typeof vi.fn> };

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
    skus = { asignarFaltantes: vi.fn().mockResolvedValue(1), enUso: vi.fn(), buscarPorCodigo: vi.fn(), guardarSkuProducto: vi.fn() };
    const module = await Test.createTestingModule({
      providers: [ProductosService, { provide: PRODUCTOS_REPOSITORY, useValue: repository }, { provide: SKU_REPOSITORY, useValue: skus }],
    }).compile();
    service = module.get(ProductosService);
  });

  it('crear() normaliza campos opcionales a null y delega al repositorio', async () => {
    repository.crear.mockResolvedValue({ ok: true, producto: productoBase });
    await service.crear('empresa-1', { nombre: 'Yerba', activo: true });
    expect(repository.crear).toHaveBeenCalledWith('empresa-1', {
      nombre: 'Yerba',
      categoriaId: null,
      precioVenta: null,
      costo: null,
      activo: true,
    });
  });

  it('actualizar() lanza NotFoundException cuando el producto no existe en esa empresa', async () => {
    repository.actualizar.mockResolvedValue({ ok: false, motivo: 'producto_no_encontrado' });
    await expect(
      service.actualizar('empresa-1', 'prod-x', { nombre: 'X', activo: true }),
    ).rejects.toThrow(NotFoundException);
  });

  it('actualizar() lanza BadRequestException cuando la categoría no pertenece a esta empresa', async () => {
    repository.actualizar.mockResolvedValue({ ok: false, motivo: 'categoria_invalida' });
    await expect(
      service.actualizar('empresa-1', 'prod-1', { nombre: 'X', activo: true, categoriaId: 'cat-ajena' }),
    ).rejects.toThrow(BadRequestException);
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
      orden: 'demanda',
      tipo: 'todos',
    });
    expect(repository.listar).toHaveBeenCalledWith('empresa-1', {
      busqueda: '',
      categoriaId: null,
      estado: 'todos',
      margen: 'todos',
      orden: 'demanda',
      tipo: 'todos',
      pagina: 1,
      pageSize: 20,
    });
    expect(resultado.total).toBe(1);
  });

  it('crear() sin SKU le genera uno automático', async () => {
    repository.crear.mockResolvedValue({ ok: true, producto: { ...productoBase, sku: null } });
    repository.buscarPorId.mockResolvedValue(productoBase);
    const creado = await service.crear('empresa-1', { nombre: 'Yerba', activo: true });
    expect(skus.asignarFaltantes).toHaveBeenCalledWith('empresa-1', 'prod-1');
    expect(creado.sku).toBe('GEN-YER-001');
  });

  it('crear() con variantes no genera SKU de producto (lo tiene cada variante)', async () => {
    repository.crear.mockResolvedValue({ ok: true, producto: { ...productoBase, sku: null, usaVariantes: true } });
    await service.crear('empresa-1', { nombre: 'Yerba', activo: true });
    expect(skus.asignarFaltantes).not.toHaveBeenCalled();
  });

  it('guardarSku() rechaza un SKU repetido', async () => {
    skus.guardarSkuProducto.mockResolvedValue({ duplicadoDe: 'Mate Imperial' });
    await expect(service.guardarSku('empresa-1', 'prod-1', 'MAT-001')).rejects.toThrow(BadRequestException);
  });

  it('buscarPorCodigo() da 404 si no existe', async () => {
    skus.buscarPorCodigo.mockResolvedValue(null);
    await expect(service.buscarPorCodigo('empresa-1', 'XX')).rejects.toThrow(NotFoundException);
  });
});

import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  PRODUCTOS_REPOSITORY,
  type ListaProductos,
  type ProductoRecord,
  type ProductosRepository,
} from './productos.repository.js';
import type {
  DimensionesProductoInput,
  GuardarProductoInput,
  ListarProductosQuery,
} from './productos.dto.js';

@Injectable()
export class ProductosService {
  constructor(@Inject(PRODUCTOS_REPOSITORY) private readonly productosRepository: ProductosRepository) {}

  crear(empresaId: string, input: GuardarProductoInput): Promise<ProductoRecord> {
    return this.productosRepository.crear(empresaId, {
      nombre: input.nombre,
      categoriaId: input.categoriaId ?? null,
      precioVenta: input.precioVenta ?? null,
      costo: input.costo ?? null,
      activo: input.activo,
    });
  }

  async actualizar(empresaId: string, id: string, input: GuardarProductoInput): Promise<ProductoRecord> {
    const producto = await this.productosRepository.actualizar(empresaId, id, {
      nombre: input.nombre,
      categoriaId: input.categoriaId ?? null,
      precioVenta: input.precioVenta ?? null,
      costo: input.costo ?? null,
      activo: input.activo,
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');
    return producto;
  }

  async buscarPorId(empresaId: string, id: string): Promise<ProductoRecord> {
    const producto = await this.productosRepository.buscarPorId(empresaId, id);
    if (!producto) throw new NotFoundException('Producto no encontrado');
    return producto;
  }

  listar(empresaId: string, query: ListarProductosQuery): Promise<ListaProductos> {
    return this.productosRepository.listar(empresaId, {
      busqueda: query.busqueda,
      categoriaId: query.categoriaId ?? null,
      estado: query.estado,
      margen: query.margen,
      pagina: query.pagina,
      pageSize: query.pageSize,
    });
  }

  listarNombres(empresaId: string): Promise<{ id: string; nombre: string }[]> {
    return this.productosRepository.listarNombres(empresaId);
  }

  async guardarCodigoBarra(empresaId: string, id: string, codigoBarra: string | null): Promise<ProductoRecord> {
    const producto = await this.productosRepository.guardarCodigoBarra(empresaId, id, codigoBarra);
    if (!producto) throw new NotFoundException('Producto no encontrado');
    return producto;
  }

  async guardarDimensiones(
    empresaId: string,
    id: string,
    dimensiones: DimensionesProductoInput,
  ): Promise<ProductoRecord> {
    const producto = await this.productosRepository.guardarDimensiones(empresaId, id, dimensiones);
    if (!producto) throw new NotFoundException('Producto no encontrado');
    return producto;
  }
}

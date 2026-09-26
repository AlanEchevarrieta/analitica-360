import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  PRODUCTOS_REPOSITORY,
  type ListaProductos,
  type ProductoRecord,
  type ProductosRepository,
  type ResultadoGuardarProducto,
} from './productos.repository.js';
import { SKU_REPOSITORY, type CodigoEncontrado, type SkuRepository } from './sku.repository.js';
import type {
  DimensionesProductoInput,
  GuardarProductoInput,
  ListarProductosQuery,
} from './productos.dto.js';

function desempacar(resultado: ResultadoGuardarProducto): ProductoRecord {
  if (resultado.ok) return resultado.producto;
  if (resultado.motivo === 'producto_no_encontrado') throw new NotFoundException('Producto no encontrado');
  throw new BadRequestException('La categoría no existe o no pertenece a esta empresa');
}

@Injectable()
export class ProductosService {
  constructor(
    @Inject(PRODUCTOS_REPOSITORY) private readonly productosRepository: ProductosRepository,
    @Inject(SKU_REPOSITORY) private readonly skuRepository: SkuRepository,
  ) {}

  /** Asigna el SKU automático si hace falta y devuelve el producto actualizado. */
  private async conSku(empresaId: string, producto: ProductoRecord): Promise<ProductoRecord> {
    if (producto.sku || producto.usaVariantes) return producto;
    await this.skuRepository.asignarFaltantes(empresaId, producto.id);
    return (await this.productosRepository.buscarPorId(empresaId, producto.id)) ?? producto;
  }

  asignarSkuFaltantes(empresaId: string): Promise<number> {
    return this.skuRepository.asignarFaltantes(empresaId);
  }

  async buscarPorCodigo(empresaId: string, codigo: string): Promise<CodigoEncontrado> {
    const encontrado = await this.skuRepository.buscarPorCodigo(empresaId, codigo);
    if (!encontrado) throw new NotFoundException(`El código ${codigo} no corresponde a ningún producto`);
    return encontrado;
  }

  async guardarSku(empresaId: string, id: string, sku: string | null): Promise<ProductoRecord> {
    const r = await this.skuRepository.guardarSkuProducto(empresaId, id, sku);
    if (r === 'no_encontrado') throw new NotFoundException('Producto no encontrado');
    if (typeof r === 'object') throw new BadRequestException(`Ese SKU ya lo tiene "${r.duplicadoDe}"`);
    return this.buscarPorId(empresaId, id);
  }

  async crear(empresaId: string, input: GuardarProductoInput): Promise<ProductoRecord> {
    const resultado = await this.productosRepository.crear(empresaId, {
      nombre: input.nombre,
      categoriaId: input.categoriaId ?? null,
      precioVenta: input.precioVenta ?? null,
      costo: input.costo ?? null,
      activo: input.activo,
    });
    return this.conSku(empresaId, desempacar(resultado));
  }

  async actualizar(empresaId: string, id: string, input: GuardarProductoInput): Promise<ProductoRecord> {
    const resultado = await this.productosRepository.actualizar(empresaId, id, {
      nombre: input.nombre,
      categoriaId: input.categoriaId ?? null,
      precioVenta: input.precioVenta ?? null,
      costo: input.costo ?? null,
      activo: input.activo,
    });
    return this.conSku(empresaId, desempacar(resultado));
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
      orden: query.orden,
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
    if ('duplicadoDe' in producto) {
      throw new BadRequestException(`Ese código de barras ya lo tiene "${producto.duplicadoDe}"`);
    }
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

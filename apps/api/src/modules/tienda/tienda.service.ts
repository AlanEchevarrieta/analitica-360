import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PEDIDOS_REPOSITORY, type PedidosRepository } from '../pedidos/pedidos.repository.js';
import { TIENDA_REPOSITORY, type ProductoCatalogo, type TiendaRepository } from './tienda.repository.js';
import type { CrearPedidoTiendaInput } from './tienda.dto.js';

export interface PedidoTiendaCreado {
  id: string;
  numeroPedido: string;
  total: number;
}

@Injectable()
export class TiendaService {
  constructor(
    @Inject(TIENDA_REPOSITORY) private readonly tiendaRepository: TiendaRepository,
    @Inject(PEDIDOS_REPOSITORY) private readonly pedidosRepository: PedidosRepository,
  ) {}

  async catalogo(empresaId: string): Promise<ProductoCatalogo[]> {
    await this.exigirEmpresaActiva(empresaId);
    return this.tiendaRepository.catalogo(empresaId);
  }

  /**
   * Los precios salen siempre de la base, nunca del request: el endpoint es
   * público y el carrito vive en el browser del cliente (el legacy
   * crear_pedido_tienda confiaba en el precio que mandaba la tienda).
   */
  async crearPedido(empresaId: string, input: CrearPedidoTiendaInput): Promise<PedidoTiendaCreado> {
    await this.exigirEmpresaActiva(empresaId);

    const productoIds = [...new Set(input.items.map((i) => i.productoId))];
    const vendibles = await this.tiendaRepository.productosVendibles(empresaId, productoIds);
    const porId = new Map(vendibles.map((p) => [p.id, p]));

    const items = input.items.map((item) => {
      const producto = porId.get(item.productoId);
      if (!producto) throw new BadRequestException('Hay un producto que ya no está disponible');
      if (!item.varianteId) {
        if (producto.variantes.length > 0) throw new BadRequestException('Elegí una variante del producto');
        return { productoId: producto.id, varianteId: null, cantidad: item.cantidad, precioUnitario: producto.precio };
      }
      const variante = producto.variantes.find((v) => v.id === item.varianteId);
      if (!variante) throw new BadRequestException('Hay una variante que ya no está disponible');
      return { productoId: producto.id, varianteId: variante.id, cantidad: item.cantidad, precioUnitario: variante.precio };
    });

    const resultado = await this.pedidosRepository.crear(empresaId, {
      origen: 'tienda_online',
      clienteNombre: input.clienteNombre,
      clienteEmail: input.clienteEmail,
      clienteTelefono: input.clienteTelefono,
      direccionEnvio: input.direccionEnvio,
      codigoPostal: input.codigoPostal,
      localidad: input.localidad,
      provincia: input.provincia,
      metodoEnvio: 'A coordinar',
      notas: input.notas || null,
      items,
    });
    if (!resultado.ok) throw new BadRequestException('No se pudo crear el pedido');

    return {
      id: resultado.pedido.id,
      numeroPedido: resultado.pedido.numeroPedido,
      total: items.reduce((acc, i) => acc + i.cantidad * i.precioUnitario, 0),
    };
  }

  private async exigirEmpresaActiva(empresaId: string): Promise<void> {
    if (!(await this.tiendaRepository.empresaActiva(empresaId))) {
      throw new NotFoundException('Tienda no encontrada');
    }
  }
}

import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PEDIDOS_REPOSITORY, type PedidosRepository } from '../pedidos/pedidos.repository.js';
import { TIENDA_REPOSITORY, type CondicionesTienda, type ProductoCatalogo, type TiendaRepository } from './tienda.repository.js';
import type { CrearPedidoTiendaInput, ValidarCuponInput } from './tienda.dto.js';
import { evaluarCupon, hoyAR, MENSAJE_CUPON, normalizarCodigo, precioConOferta, totalesPedido } from './precios-tienda.util.js';

export interface PedidoTiendaCreado {
  id: string;
  numeroPedido: string;
  subtotal: number;
  descuentoCupon: number;
  descuentoTransferencia: number;
  total: number;
}

const ARS = (n: number) => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

@Injectable()
export class TiendaService {
  constructor(
    @Inject(TIENDA_REPOSITORY) private readonly tiendaRepository: TiendaRepository,
    @Inject(PEDIDOS_REPOSITORY) private readonly pedidosRepository: PedidosRepository,
  ) {}

  /** Catálogo con las ofertas vigentes hoy aplicadas (precio final y el de lista para tacharlo). */
  async catalogo(empresaId: string): Promise<ProductoCatalogo[]> {
    await this.exigirEmpresaActiva(empresaId);
    const hoy = hoyAR();
    return (await this.tiendaRepository.catalogo(empresaId)).map(({ oferta, ...p }) => {
      const final = precioConOferta(p.precio, oferta, hoy);
      return {
        ...p,
        ...final,
        // La oferta del producto vale para todas sus variantes (con precio fijo, si baja el de esa variante).
        variantes: p.variantes.map((v) => {
          const fv = precioConOferta(v.precio, oferta, hoy);
          return { ...v, precio: fv.precio, precioLista: fv.precioLista };
        }),
      };
    });
  }

  async condiciones(empresaId: string): Promise<CondicionesTienda> {
    await this.exigirEmpresaActiva(empresaId);
    return this.tiendaRepository.condiciones(empresaId);
  }

  /** Para el checkout: ¿vale el código con este subtotal? (el pedido lo vuelve a verificar). */
  async validarCupon(empresaId: string, input: ValidarCuponInput) {
    await this.exigirEmpresaActiva(empresaId);
    const codigo = normalizarCodigo(input.codigo);
    const r = evaluarCupon(await this.tiendaRepository.cupon(empresaId, codigo), input.subtotal, hoyAR());
    if (!r.ok) return { valido: false as const, mensaje: r.motivo === 'compra_minima' ? `Ese código es para compras desde ${ARS(r.minimo ?? 0)}` : MENSAJE_CUPON[r.motivo] };
    return { valido: true as const, codigo, descuento: r.descuento };
  }

  /**
   * Los precios y descuentos salen siempre de la base, nunca del request: el
   * endpoint es público y el carrito vive en el browser del cliente (el legacy
   * crear_pedido_tienda confiaba en el precio que mandaba la tienda).
   */
  async crearPedido(empresaId: string, input: CrearPedidoTiendaInput, clienteId: string | null = null): Promise<PedidoTiendaCreado> {
    await this.exigirEmpresaActiva(empresaId);
    const hoy = hoyAR();

    const productoIds = [...new Set(input.items.map((i) => i.productoId))];
    const vendibles = await this.tiendaRepository.productosVendibles(empresaId, productoIds);
    const porId = new Map(vendibles.map((p) => [p.id, p]));

    let descuentoOfertas = 0;
    const items = input.items.map((item) => {
      const producto = porId.get(item.productoId);
      if (!producto) throw new BadRequestException('Hay un producto que ya no está disponible');
      let varianteId: string | null = null;
      let lista = producto.precio;
      if (item.varianteId) {
        const variante = producto.variantes.find((v) => v.id === item.varianteId);
        if (!variante) throw new BadRequestException('Hay una variante que ya no está disponible');
        varianteId = variante.id;
        lista = variante.precio;
      } else if (producto.variantes.length > 0) {
        throw new BadRequestException('Elegí una variante del producto');
      }
      // La oferta va en el precio del ítem: la venta registra lo que realmente se cobró.
      const { precio } = precioConOferta(lista, producto.oferta, hoy);
      descuentoOfertas += (Math.round(lista) - precio) * item.cantidad;
      return { productoId: producto.id, varianteId, cantidad: item.cantidad, precioUnitario: precio };
    });

    const subtotal = items.reduce((acc, i) => acc + i.cantidad * i.precioUnitario, 0);
    const condiciones = await this.tiendaRepository.condiciones(empresaId);
    if (condiciones.pedidoMinimo && subtotal < condiciones.pedidoMinimo) {
      throw new BadRequestException(`La compra mínima es de ${ARS(condiciones.pedidoMinimo)}`);
    }

    // Cupón: se valida y se reserva el uso antes de crear el pedido (si el pedido falla, se devuelve).
    const codigo = input.cuponCodigo ? normalizarCodigo(input.cuponCodigo) : null;
    let descuentoCupon = 0;
    if (codigo) {
      const r = evaluarCupon(await this.tiendaRepository.cupon(empresaId, codigo), subtotal, hoy);
      if (!r.ok) throw new BadRequestException(r.motivo === 'compra_minima' ? `Ese código es para compras desde ${ARS(r.minimo ?? 0)}` : MENSAJE_CUPON[r.motivo]);
      if (!(await this.tiendaRepository.usarCupon(empresaId, codigo))) throw new BadRequestException(MENSAJE_CUPON.agotado);
      descuentoCupon = r.descuento;
    }
    const pagaPorTransferencia = input.formaPago === 'transferencia';
    const totales = totalesPedido(subtotal, descuentoCupon, condiciones.descuentoTransferencia, pagaPorTransferencia);

    let resultado;
    try {
      resultado = await this.pedidosRepository.crear(empresaId, {
        origen: 'tienda_online',
        clienteId,
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
        descuentos: {
          cuponCodigo: codigo,
          ofertas: descuentoOfertas,
          cupon: totales.descuentoCupon,
          transferencia: totales.descuentoTransferencia,
          formaPago: pagaPorTransferencia ? 'transferencia' : 'a_coordinar',
        },
      });
    } catch (e) {
      if (codigo) await this.tiendaRepository.devolverCupon(empresaId, codigo);
      throw e;
    }
    if (!resultado.ok) {
      if (codigo) await this.tiendaRepository.devolverCupon(empresaId, codigo);
      throw new BadRequestException('No se pudo crear el pedido');
    }

    return { id: resultado.pedido.id, numeroPedido: resultado.pedido.numeroPedido, ...totales };
  }

  private async exigirEmpresaActiva(empresaId: string): Promise<void> {
    if (!(await this.tiendaRepository.empresaActiva(empresaId))) {
      throw new NotFoundException('Tienda no encontrada');
    }
  }
}

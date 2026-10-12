import { Inject, Injectable, NotFoundException, type OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { OrdenesCompraService } from '../compras/ordenes-compra.service.js';
import { PEDIDOS_REPOSITORY, type PedidosRepository } from '../pedidos/pedidos.repository.js';
import { DocumentosService } from './documentos.service.js';
import { TITULO } from './documentos.util.js';

const conVariante = (nombre: string, variante: string | null) => (variante ? `${nombre} (${variante})` : nombre);

/** Orden de compra (al proveedor) y remito del pedido, con el mismo PDF y envío que el resto de los documentos. */
@Injectable()
export class ArmadoresComprasPedidos implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentos: DocumentosService,
    private readonly ordenes: OrdenesCompraService,
    @Inject(PEDIDOS_REPOSITORY) private readonly pedidos: PedidosRepository,
  ) {}

  onModuleInit() {
    this.documentos.registrar('orden_compra', (e, id) => this.ordenCompra(e, id));
    this.documentos.registrar('remito', (e, id) => this.remito(e, id));
  }

  private async ordenCompra(empresaId: string, id: string) {
    const oc = await this.ordenes.ficha(empresaId, id);
    const prov = oc.proveedorId ? await this.prisma.proveedor.findFirst({ where: { id: oc.proveedorId, empresaId }, select: { telefono: true, email: true } }) : null;
    const dmy = (f: string) => f.slice(0, 10).split('-').reverse().join('/');
    return {
      tipo: 'orden_compra' as const,
      titulo: TITULO.orden_compra,
      etiquetaCliente: 'Proveedor',
      numero: oc.numeroOc,
      fecha: oc.fechaEmision,
      extras: oc.fechaEntregaEstimada ? [`Entrega estimada: ${dmy(oc.fechaEntregaEstimada)}`] : [],
      cliente: {
        nombre: oc.proveedorNombre,
        telefono: prov?.telefono ?? null,
        email: prov?.email ?? null,
        extra: [oc.proveedorCuit && `CUIT ${oc.proveedorCuit}`, oc.proveedorContacto && `Contacto: ${oc.proveedorContacto}`].filter((x): x is string => Boolean(x)),
      },
      items: oc.items.map((i) => ({ descripcion: conVariante(i.productoNombre, i.varianteEtiqueta), cantidad: i.cantidadPedida, precio: i.precioUnitario })),
      resumen: [],
      total: { etiqueta: 'Total', monto: oc.total },
      totalNumero: oc.total,
      detalles: [],
      notas: oc.notas,
    };
  }

  private async remito(empresaId: string, id: string) {
    const p = await this.pedidos.ficha(empresaId, id);
    if (!p) throw new NotFoundException('Pedido no encontrado');
    const direccion = [p.direccionEnvio, [p.localidad, p.provincia, p.codigoPostal].filter(Boolean).join(', ')].filter((x): x is string => Boolean(x));
    const items = p.items.map((i) => ({ descripcion: conVariante(i.productoNombre, i.varianteEtiqueta), cantidad: i.cantidad, precio: i.precioUnitario }));
    const subtotal = items.reduce((s, i) => s + i.cantidad * i.precio, 0);
    const resumen: { etiqueta: string; monto: number }[] = [];
    if (p.costoEnvio > 0 || Math.abs(subtotal - p.total) > 0.009) resumen.push({ etiqueta: 'Productos', monto: subtotal });
    const descuentos = subtotal + p.costoEnvio - p.total;
    if (descuentos > 0.009) resumen.push({ etiqueta: 'Descuentos', monto: -descuentos });
    if (p.costoEnvio > 0) resumen.push({ etiqueta: `Envío${p.metodoEnvio ? ` (${p.metodoEnvio})` : ''}`, monto: p.costoEnvio });
    return {
      tipo: 'remito' as const,
      titulo: TITULO.remito,
      etiquetaCliente: 'Entregar a',
      numero: p.numeroPedido,
      fecha: p.createdAt.toISOString(),
      extras: p.transportista ? [`Transporte: ${p.transportista}${p.numeroSeguimiento ? ` · ${p.numeroSeguimiento}` : ''}`] : [],
      cliente: { nombre: p.clienteNombre, telefono: p.clienteTelefono, email: p.clienteEmail, extra: direccion },
      items,
      resumen,
      total: { etiqueta: 'Total', monto: p.total },
      totalNumero: p.total,
      detalles: ['Recibí conforme: ______________________   Aclaración: ______________________'],
      notas: p.notas,
    };
  }
}

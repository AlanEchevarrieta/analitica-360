import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, type OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { DocumentosService } from '../documentos/documentos.service.js';
import { nombrePago, numeroDocumento } from '../documentos/documentos.util.js';
import { calcularTotalesCredito } from '../ventas/ventas.util.js';
import { VentasService } from '../ventas/ventas.service.js';
import { abierta, NOMBRE_ESTADO_OT, ventaDeEntrega, type EstadoManual, type EstadoOt } from './ordenes-trabajo.util.js';

export interface ItemOtInput {
  productoId: string;
  varianteId?: string | null;
  cantidad: number;
  precioUnitario: number;
}

export interface OrdenTrabajoInput {
  clienteId?: string | null;
  clienteNombre?: string | null;
  clienteTelefono?: string | null;
  equipo: string;
  problema?: string | null;
  notasInternas?: string | null;
  responsableId?: string | null;
  fechaPrometida?: string | null;
  items?: ItemOtInput[];
  descuento?: number;
  /** Seña al recibir (solo al crear; pide el cliente cargado). */
  senia?: { monto: number; formaPago: string } | null;
}

export interface EntregaInput {
  formaPago: string;
  cuotas?: number;
  coeficienteInteres?: number;
  ubicacionOrigen?: string | null;
}

type Db = Prisma.TransactionClient | PrismaService;
const numeroOt = (n: number) => `OT-${String(n).padStart(6, '0')}`;
const fecha = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Órdenes de trabajo (módulo de servicios, pieza 2, plan Pro): el cliente deja un
 * equipo o encarga un trabajo; se sigue por etapas y al entregar se arma la venta
 * (mano de obra y repuestos: estos sí descuentan stock). La seña es un cobro del
 * cliente que se le aplica a esa venta con su fecha, así la caja la cuenta el día
 * que entró la plata.
 */
@Injectable()
export class OrdenesTrabajoService implements OnModuleInit {
  private readonly logger = new Logger('OrdenesTrabajo');

  constructor(
    private readonly prisma: PrismaService,
    private readonly ventas: VentasService,
    private readonly documentos: DocumentosService,
  ) {}

  onModuleInit() {
    this.documentos.registrar('orden_trabajo', (empresaId, id) => this.datosPdf(empresaId, id));
  }

  // ---- Lectura -------------------------------------------------------------

  private totales(items: { cantidad: number; precioUnitario: Prisma.Decimal | number }[], descuento: number) {
    const subtotal = r2(items.reduce((s, i) => s + i.cantidad * Number(i.precioUnitario), 0));
    return { subtotal, total: Math.max(0, r2(subtotal - descuento)) };
  }

  private async seniaDe(db: Db, cobroId: string | null) {
    if (!cobroId) return null;
    const c = await db.cobroCliente.findUnique({ where: { id: cobroId } });
    if (!c || c.anuladoAt) return null;
    return { cobroId: c.id, monto: c.monto.toNumber(), formaPago: c.formaPago, fecha: c.fecha.toISOString(), recibo: c.numeroRecibo ? numeroDocumento('R', c.numeroRecibo) : null };
  }

  async listar(empresaId: string, estado?: string) {
    const filas = await this.prisma.ordenTrabajo.findMany({
      where: { empresaId, ...(estado === 'abiertas' ? { estado: { in: ['recibido', 'en_proceso', 'listo'] } } : estado && estado !== 'todas' ? { estado } : {}) },
      include: { items: { select: { cantidad: true, precioUnitario: true } } },
      orderBy: { numero: 'desc' },
      take: 500,
    });
    const [responsables, senias] = await Promise.all([
      this.prisma.usuario.findMany({ where: { empresaId, id: { in: [...new Set(filas.map((f) => f.responsableId).filter((x): x is string => Boolean(x)))] } }, select: { id: true, nombre: true } }),
      this.prisma.cobroCliente.findMany({ where: { id: { in: filas.map((f) => f.seniaCobroId).filter((x): x is string => Boolean(x)) }, anuladoAt: null }, select: { id: true, monto: true } }),
    ]);
    return filas.map((f) => ({
      id: f.id,
      numero: numeroOt(f.numero),
      estado: f.estado as EstadoOt,
      clienteNombre: f.clienteNombre,
      equipo: f.equipo,
      responsable: responsables.find((r) => r.id === f.responsableId)?.nombre ?? null,
      fechaPrometida: fecha(f.fechaPrometida),
      createdAt: f.createdAt.toISOString(),
      total: this.totales(f.items, f.descuento.toNumber()).total,
      senia: senias.find((s) => s.id === f.seniaCobroId)?.monto.toNumber() ?? 0,
    }));
  }

  responsables(empresaId: string) {
    return this.prisma.usuario.findMany({ where: { empresaId, activo: true, deletedAt: null }, select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } });
  }

  private async buscar(empresaId: string, id: string, db: Db = this.prisma) {
    const ot = await db.ordenTrabajo.findFirst({ where: { id, empresaId }, include: { items: true, historial: { orderBy: { createdAt: 'asc' } } } });
    if (!ot) throw new NotFoundException('Orden de trabajo no encontrada');
    return ot;
  }

  async ficha(empresaId: string, id: string) {
    const ot = await this.buscar(empresaId, id);
    const usuarioIds = [...new Set([ot.responsableId, ...ot.historial.map((h) => h.usuarioId)].filter((x): x is string => Boolean(x)))];
    const [cliente, usuarios, senia, venta, stock] = await Promise.all([
      ot.clienteId ? this.prisma.cliente.findFirst({ where: { id: ot.clienteId, empresaId }, select: { nombre: true, telefono: true, email: true } }) : null,
      this.prisma.usuario.findMany({ where: { id: { in: usuarioIds } }, select: { id: true, nombre: true } }),
      this.seniaDe(this.prisma, ot.seniaCobroId),
      ot.ventaId ? this.prisma.venta.findFirst({ where: { id: ot.ventaId }, select: { numeroVenta: true } }) : null,
      this.stockDe(empresaId, ot.items),
    ]);
    const nombre = (uid: string | null) => usuarios.find((u) => u.id === uid)?.nombre ?? null;
    const items = [...ot.items].sort((a, b) => a.orden - b.orden).map((i, n) => ({ id: i.id, productoId: i.productoId, varianteId: i.varianteId, descripcion: i.descripcion, cantidad: i.cantidad, precioUnitario: i.precioUnitario.toNumber(), stock: stock[n] }));
    const { subtotal, total } = this.totales(ot.items, ot.descuento.toNumber());
    return {
      id: ot.id,
      numero: numeroOt(ot.numero),
      estado: ot.estado as EstadoOt,
      clienteId: ot.clienteId,
      clienteNombre: ot.clienteNombre,
      clienteTelefono: ot.clienteTelefono ?? cliente?.telefono ?? null,
      cliente,
      equipo: ot.equipo,
      problema: ot.problema,
      notasInternas: ot.notasInternas,
      responsableId: ot.responsableId,
      responsable: nombre(ot.responsableId),
      fechaPrometida: fecha(ot.fechaPrometida),
      descuento: ot.descuento.toNumber(),
      items,
      subtotal,
      total,
      senia,
      saldo: Math.max(0, r2(total - (senia?.monto ?? 0))),
      presupuestoId: ot.presupuestoId,
      ventaId: ot.ventaId,
      numeroVenta: venta?.numeroVenta ?? null,
      entregadaEn: ot.entregadaEn?.toISOString() ?? null,
      createdAt: ot.createdAt.toISOString(),
      historial: ot.historial.map((h) => ({ estado: h.estado as EstadoOt, fecha: h.createdAt.toISOString(), usuario: nombre(h.usuarioId), nota: h.nota })),
    };
  }

  /** Stock de hoy de los repuestos (null en servicios y kits), para avisar faltantes antes de entregar. */
  private async stockDe(empresaId: string, items: { productoId: string; varianteId: string | null }[]): Promise<(number | null)[]> {
    if (items.length === 0) return [];
    const ids = [...new Set(items.map((i) => i.productoId))];
    const [filas, kits, servicios] = await Promise.all([
      this.prisma.movimientoInventario.groupBy({ by: ['productoId', 'varianteId', 'signo'], where: { empresaId, deletedAt: null, productoId: { in: ids } }, _sum: { cantidad: true } }),
      this.prisma.receta.findMany({ where: { empresaId, deletedAt: null, armarAlVender: true, productoId: { in: ids } }, select: { productoId: true } }),
      this.prisma.producto.findMany({ where: { empresaId, id: { in: ids }, esServicio: true }, select: { id: true } }),
    ]);
    return items.map((i) => {
      if (servicios.some((s) => s.id === i.productoId) || kits.some((k) => k.productoId === i.productoId)) return null;
      return filas.filter((f) => f.productoId === i.productoId && (i.varianteId ? f.varianteId === i.varianteId : true)).reduce((s, f) => s + (f._sum.cantidad?.toNumber() ?? 0) * f.signo, 0);
    });
  }

  // ---- Alta y edición ----------------------------------------------------

  private async validar(empresaId: string, input: OrdenTrabajoInput) {
    const items = input.items ?? [];
    const productos = items.length
      ? await this.prisma.producto.findMany({ where: { empresaId, id: { in: [...new Set(items.map((i) => i.productoId))] }, deletedAt: null, esInsumo: false }, select: { id: true, nombre: true, variantes: { select: { id: true, atributos: true } } } })
      : [];
    const renglones = items.map((i, orden) => {
      const p = productos.find((x) => x.id === i.productoId);
      if (!p) throw new BadRequestException('Hay un producto que no existe en tu empresa (o es un insumo)');
      const v = i.varianteId ? p.variantes.find((x) => x.id === i.varianteId) : null;
      if (i.varianteId && !v) throw new BadRequestException(`La variante de ${p.nombre} no existe`);
      const etiqueta = v ? Object.values(v.atributos as Record<string, string>).filter(Boolean).join(' / ') : '';
      return { productoId: p.id, varianteId: v?.id ?? null, descripcion: etiqueta ? `${p.nombre} (${etiqueta})` : p.nombre, cantidad: i.cantidad, precioUnitario: new Prisma.Decimal(i.precioUnitario), orden };
    });
    const descuento = input.descuento ?? 0;
    if (descuento > this.totales(renglones, 0).subtotal) throw new BadRequestException('El descuento no puede ser mayor que el subtotal');
    let clienteNombre = input.clienteNombre?.trim() || null;
    if (input.clienteId) {
      const c = await this.prisma.cliente.findFirst({ where: { id: input.clienteId, empresaId, deletedAt: null }, select: { nombre: true } });
      if (!c) throw new BadRequestException('El cliente no existe en tu empresa');
      clienteNombre = c.nombre;
    }
    if (input.responsableId && !(await this.prisma.usuario.count({ where: { id: input.responsableId, empresaId } }))) throw new BadRequestException('El responsable no es de tu empresa');
    return { renglones, clienteNombre, descuento };
  }

  async crear(empresaId: string, usuarioId: string, input: OrdenTrabajoInput, presupuestoId: string | null = null) {
    const { renglones, clienteNombre, descuento } = await this.validar(empresaId, input);
    const senia = input.senia && input.senia.monto > 0 ? input.senia : null;
    if (senia && !input.clienteId) throw new BadRequestException('Para registrar una seña, elegí o creá el cliente (queda en su cuenta)');
    if (senia && senia.monto > this.totales(renglones, descuento).total && renglones.length > 0) throw new BadRequestException('La seña no puede superar el total de la orden');
    for (let intento = 0; intento < 3; intento++) {
      try {
        const ot = await this.prisma.$transaction(async (tx) => {
          const ultimo = await tx.ordenTrabajo.aggregate({ where: { empresaId }, _max: { numero: true } });
          const numero = (ultimo._max.numero ?? 0) + 1;
          const cobro = senia
            ? await tx.cobroCliente.create({ data: { empresaId, clienteId: input.clienteId!, monto: senia.monto, formaPago: senia.formaPago, fecha: new Date(), notas: `Seña de la orden ${numeroOt(numero)}`, usuarioId } })
            : null;
          return tx.ordenTrabajo.create({
            data: {
              empresaId, numero, usuarioId, clienteId: input.clienteId ?? null, clienteNombre, clienteTelefono: input.clienteTelefono?.trim() || null,
              equipo: input.equipo.trim(), problema: input.problema?.trim() || null, notasInternas: input.notasInternas?.trim() || null,
              responsableId: input.responsableId ?? null, fechaPrometida: input.fechaPrometida ? new Date(`${input.fechaPrometida}T00:00:00Z`) : null,
              descuento: new Prisma.Decimal(descuento), presupuestoId, seniaCobroId: cobro?.id ?? null,
              items: { create: renglones },
              historial: { create: { estado: 'recibido', usuarioId } },
            },
          });
        });
        return this.ficha(empresaId, ot.id);
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
        if (presupuestoId && String(e.meta?.target ?? '').includes('presupuesto')) throw new ConflictException('Ese presupuesto ya tiene una orden de trabajo');
      }
    }
    throw new ConflictException('No se pudo numerar la orden. Probá de nuevo.');
  }

  /** Desde un presupuesto: copia cliente e ítems y lo marca como aceptado. */
  async desdePresupuesto(empresaId: string, usuarioId: string, presupuestoId: string, datos: Omit<OrdenTrabajoInput, 'items' | 'clienteId' | 'clienteNombre' | 'descuento'>) {
    const p = await this.prisma.presupuesto.findFirst({ where: { id: presupuestoId, empresaId, deletedAt: null }, include: { items: true } });
    if (!p) throw new NotFoundException('Presupuesto no encontrado');
    if (p.estado === 'aceptado') throw new ConflictException('El presupuesto ya pasó a venta o a una orden de trabajo');
    const ot = await this.crear(
      empresaId,
      usuarioId,
      { ...datos, clienteId: p.clienteId, clienteNombre: p.clienteNombre, descuento: p.descuento.toNumber(), items: [...p.items].sort((a, b) => a.orden - b.orden).map((i) => ({ productoId: i.productoId, varianteId: i.varianteId, cantidad: i.cantidad, precioUnitario: i.precioUnitario.toNumber() })) },
      presupuestoId,
    );
    await this.prisma.presupuesto.update({ where: { id: presupuestoId }, data: { estado: 'aceptado' } });
    return ot;
  }

  async editar(empresaId: string, id: string, input: OrdenTrabajoInput) {
    const ot = await this.buscar(empresaId, id);
    if (!abierta(ot.estado)) throw new BadRequestException('La orden ya está entregada o cancelada');
    const { renglones, clienteNombre, descuento } = await this.validar(empresaId, input);
    const senia = await this.seniaDe(this.prisma, ot.seniaCobroId);
    if (senia && input.clienteId !== ot.clienteId) throw new BadRequestException('La orden tiene seña: no se puede cambiar el cliente');
    if (senia && renglones.length && senia.monto > this.totales(renglones, descuento).total) throw new BadRequestException('El total no puede quedar por debajo de la seña');
    await this.prisma.$transaction(async (tx) => {
      await tx.ordenTrabajoItem.deleteMany({ where: { ordenId: id } });
      await tx.ordenTrabajo.update({
        where: { id },
        data: {
          clienteId: input.clienteId ?? null, clienteNombre, clienteTelefono: input.clienteTelefono?.trim() || null, equipo: input.equipo.trim(),
          problema: input.problema?.trim() || null, notasInternas: input.notasInternas?.trim() || null, responsableId: input.responsableId ?? null,
          fechaPrometida: input.fechaPrometida ? new Date(`${input.fechaPrometida}T00:00:00Z`) : null, descuento: new Prisma.Decimal(descuento),
          items: { create: renglones },
        },
      });
    });
    return this.ficha(empresaId, id);
  }

  async cambiarEstado(empresaId: string, id: string, usuarioId: string, estado: EstadoManual, nota?: string | null) {
    const ot = await this.buscar(empresaId, id);
    if (!abierta(ot.estado)) throw new BadRequestException('La orden ya está entregada o cancelada');
    if (ot.estado === estado) return this.ficha(empresaId, id);
    await this.prisma.ordenTrabajo.update({ where: { id }, data: { estado, historial: { create: { estado, usuarioId, nota: nota?.trim() || null } } } });
    return this.ficha(empresaId, id);
  }

  // ---- Entrega y cancelación -------------------------------------------

  /** Arma la venta (mano de obra y repuestos), cobra lo que falta y le aplica la seña con su fecha. */
  async entregar(empresaId: string, id: string, usuarioId: string, input: EntregaInput) {
    const ot = await this.buscar(empresaId, id);
    if (!abierta(ot.estado)) throw new BadRequestException('La orden ya está entregada o cancelada');
    if (ot.items.length === 0) throw new BadRequestException('Agregá lo que se cobra (mano de obra, repuestos) antes de entregar');
    const descuento = ot.descuento.toNumber();
    const { subtotal } = this.totales(ot.items, descuento);
    const total = calcularTotalesCredito(r2(subtotal - descuento), input.coeficienteInteres ?? 0, input.cuotas ?? 1).totalConInteres;
    const senia = await this.seniaDe(this.prisma, ot.seniaCobroId);
    const plan = ventaDeEntrega(total, senia?.monto ?? 0, input.formaPago);
    if (!plan.ok) throw new BadRequestException(plan.motivo);
    if (plan.formaPago === 'cuenta_corriente' && !ot.clienteId) throw new BadRequestException('Para dejar saldo a cuenta, la orden tiene que tener el cliente cargado');

    const venta = await this.ventas.confirmar(empresaId, usuarioId, {
      items: [...ot.items].sort((a, b) => a.orden - b.orden).map((i) => ({ productoId: i.productoId, varianteId: i.varianteId, cantidad: i.cantidad, precioUnitario: i.precioUnitario.toNumber() })),
      formaPago: plan.formaPago as never,
      descuento,
      clienteNombre: ot.clienteNombre,
      clienteId: ot.clienteId,
      listaPrecioId: null,
      cuotas: input.cuotas ?? 1,
      coeficienteInteres: input.coeficienteInteres ?? 0,
      ubicacionOrigen: input.ubicacionOrigen ?? null,
      esSenia: plan.esSenia,
      montoSenia: plan.montoSenia,
    });

    try {
      await this.prisma.$transaction(async (tx) => {
        if (senia && plan.aplicarSenia > 0) {
          await tx.cobroAplicacion.create({ data: { cobroId: senia.cobroId, ventaId: venta.id, monto: plan.aplicarSenia } });
          const v = await tx.venta.update({ where: { id: venta.id }, data: { saldoPendiente: { decrement: plan.aplicarSenia } }, select: { saldoPendiente: true } });
          if (v.saldoPendiente.toNumber() <= 0.009) await tx.venta.update({ where: { id: venta.id }, data: { saldoPendiente: 0, estadoCobro: 'pagado', fechaCobroSaldo: new Date(senia.fecha) } });
        }
        const { count } = await tx.ordenTrabajo.updateMany({ where: { id, estado: { in: ['recibido', 'en_proceso', 'listo'] } }, data: { estado: 'entregado', ventaId: venta.id, entregadaEn: new Date() } });
        if (count === 0) throw new ConflictException('La orden cambió mientras se entregaba');
        await tx.ordenTrabajoEstado.create({ data: { ordenId: id, estado: 'entregado', usuarioId, nota: `Venta ${venta.numeroVenta}` } });
        if (ot.presupuestoId) await tx.presupuesto.update({ where: { id: ot.presupuestoId }, data: { estado: 'aceptado', ventaId: venta.id } }).catch(() => undefined);
      });
    } catch (e) {
      // Sin la orden actualizada, la venta no tiene sentido: se anula para no dejarla colgada.
      this.logger.error(`Entrega de ${numeroOt(ot.numero)}: ${(e as Error).message}. Se anula la venta ${venta.numeroVenta}.`);
      await this.ventas.anular(empresaId, usuarioId, venta.id, { motivo: `Falló la entrega de ${numeroOt(ot.numero)}` }).catch(() => undefined);
      throw e;
    }
    return this.ficha(empresaId, id);
  }

  /** Cancela la orden. Si dejó seña, se registra como devuelta (el cobro se anula). */
  async cancelar(empresaId: string, id: string, usuarioId: string, motivo: string) {
    const ot = await this.buscar(empresaId, id);
    if (!abierta(ot.estado)) throw new BadRequestException('La orden ya está entregada o cancelada');
    await this.prisma.$transaction(async (tx) => {
      if (ot.seniaCobroId) await tx.cobroCliente.updateMany({ where: { id: ot.seniaCobroId, anuladoAt: null }, data: { anuladoAt: new Date(), notas: `Seña devuelta: se canceló la orden ${numeroOt(ot.numero)}` } });
      await tx.ordenTrabajo.update({ where: { id }, data: { estado: 'cancelada', historial: { create: { estado: 'cancelada', usuarioId, nota: motivo.trim().slice(0, 300) || null } } } });
      // El presupuesto (si vino de uno) vuelve a quedar pendiente.
      if (ot.presupuestoId) await tx.presupuesto.update({ where: { id: ot.presupuestoId }, data: { estado: 'pendiente' } }).catch(() => undefined);
    });
    return this.ficha(empresaId, id);
  }

  // ---- Comprobante de recepción ------------------------------------------

  private async datosPdf(empresaId: string, id: string) {
    const o = await this.ficha(empresaId, id);
    const dmy = (f: string) => f.slice(0, 10).split('-').reverse().join('/');
    const pesos = (n: number) => `$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const detalles = [`Estado: ${NOMBRE_ESTADO_OT[o.estado]}`];
    if (o.senia) detalles.push(`Seña: ${pesos(o.senia.monto)} (${nombrePago(o.senia.formaPago)}, ${dmy(o.senia.fecha)})`);
    if (o.items.length && o.estado !== 'entregado') detalles.push(`Saldo a pagar al retirar: ${pesos(o.saldo)}`);
    const notas = [`Equipo / trabajo: ${o.equipo}`, o.problema ? `Falla o pedido: ${o.problema}` : null].filter(Boolean).join('\n');
    return {
      tipo: 'orden_trabajo' as const,
      titulo: 'Orden de trabajo',
      numero: o.numero,
      fecha: o.createdAt,
      extras: [o.fechaPrometida ? `Fecha estimada: ${dmy(o.fechaPrometida)}` : null, o.responsable ? `Atiende: ${o.responsable}` : null].filter((x): x is string => Boolean(x)),
      cliente: { nombre: o.cliente?.nombre ?? o.clienteNombre, telefono: o.clienteTelefono, email: o.cliente?.email ?? null },
      items: o.items.length ? o.items.map((i) => ({ descripcion: i.descripcion, cantidad: i.cantidad, precio: i.precioUnitario })) : null,
      resumen: o.descuento > 0 ? [{ etiqueta: 'Subtotal', monto: o.subtotal }, { etiqueta: 'Descuento', monto: -o.descuento }] : [],
      total: { etiqueta: o.items.length ? 'Total' : 'Presupuesto a confirmar', monto: o.total },
      totalNumero: o.total,
      detalles,
      notas,
    };
  }
}

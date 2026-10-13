import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { fechaHoyAR } from '../analytics/analytics.util.js';
import { desdeHoraAR } from '../agenda/agenda.util.js';
import { VentasService } from '../ventas/ventas.service.js';
import { baseDeVenta, liquidar, type VentaComision } from './comisiones.util.js';

export interface PagoComisionInput {
  recursoId: string;
  desde: string;
  hasta: string;
  monto: number;
  /** También como gasto (categoría sueldos) para que cuente en la ganancia y la caja. */
  registrarGasto: boolean;
  nota?: string | null;
}

const dia = (f: string) => new Date(`${f}T00:00:00Z`);
const fecha = (d: Date) => d.toISOString().slice(0, 10);
const diaMes = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;

/**
 * Comisiones por profesional (módulo de servicios, pieza 5, plan Pro). La base es lo que vendió
 * cada uno (ventas con su nombre: el turno cobrado, la orden de trabajo entregada o elegido en
 * Nueva venta), separado en servicios y productos, menos devoluciones; más un fijo por cada
 * sesión de abono que atendió desde la agenda.
 */
@Injectable()
export class ComisionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ventas: VentasService,
  ) {}

  private rango(desde: string, hasta: string) {
    if (desde > hasta) throw new BadRequestException('El "desde" tiene que ser antes del "hasta"');
    return { gte: desdeHoraAR(`${desde}T00:00`), lt: new Date(desdeHoraAR(`${hasta}T00:00`).getTime() + 86_400_000) };
  }

  /** Ventas del período por profesional, con su base de servicios y productos. */
  private async ventasDe(empresaId: string, desde: string, hasta: string, profesionalIds: string[]) {
    const ventas = await this.prisma.venta.findMany({
      where: { empresaId, deletedAt: null, profesionalId: { in: profesionalIds }, fecha: this.rango(desde, hasta) },
      select: { id: true, numeroVenta: true, fecha: true, clienteNombre: true, cliente: { select: { nombre: true } }, descuento: true, profesionalId: true, items: { select: { cantidad: true, precioUnitario: true, producto: { select: { esServicio: true } } } } },
      orderBy: { fecha: 'asc' },
    });
    const devoluciones = await this.prisma.devolucion.findMany({
      where: { empresaId, deletedAt: null, estado: { not: 'cancelado' }, ventaId: { in: ventas.map((v) => v.id) } },
      select: { ventaId: true, items: { select: { cantidad: true, precioUnitario: true, tipo: true, producto: { select: { esServicio: true } } } } },
    });
    return ventas.map((v) => {
      const items = v.items.map((i) => ({ esServicio: i.producto.esServicio, importe: i.cantidad * i.precioUnitario.toNumber() }));
      const devueltos = devoluciones
        .filter((d) => d.ventaId === v.id)
        .flatMap((d) => d.items.map((i) => ({ esServicio: i.producto.esServicio, importe: (i.tipo === 'entregado' ? 1 : -1) * i.cantidad.toNumber() * i.precioUnitario.toNumber() })));
      const venta: VentaComision = { subtotal: items.reduce((s, i) => s + i.importe, 0), descuento: v.descuento.toNumber(), items: [...items, ...devueltos] };
      return { id: v.id, numero: v.numeroVenta, fecha: v.fecha.toISOString(), cliente: v.cliente?.nombre ?? v.clienteNombre, profesionalId: v.profesionalId!, venta, base: baseDeVenta(venta) };
    });
  }

  /** Sesiones de abono atendidas desde la agenda en el período, por profesional. */
  private async sesionesDe(empresaId: string, desde: string, hasta: string) {
    const usos = await this.prisma.abonoUso.findMany({ where: { empresaId, turnoId: { not: null }, fecha: this.rango(desde, hasta) }, select: { turnoId: true } });
    const turnos = await this.prisma.turno.findMany({ where: { empresaId, id: { in: usos.map((u) => u.turnoId!) } }, select: { recursoId: true } });
    const porRecurso = new Map<string, number>();
    for (const t of turnos) porRecurso.set(t.recursoId, (porRecurso.get(t.recursoId) ?? 0) + 1);
    return porRecurso;
  }

  async liquidacion(empresaId: string, desde: string, hasta: string, soloRecursoId?: string) {
    const recursos = await this.prisma.agendaRecurso.findMany({
      where: { empresaId, ...(soloRecursoId ? { id: soloRecursoId } : { deletedAt: null }) },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    });
    const ids = recursos.map((r) => r.id);
    const [ventas, sesiones, pagos] = await Promise.all([
      this.ventasDe(empresaId, desde, hasta, ids),
      this.sesionesDe(empresaId, desde, hasta),
      this.prisma.comisionPago.findMany({ where: { empresaId, recursoId: { in: ids }, desde: { gte: dia(desde) }, hasta: { lte: dia(hasta) } }, orderBy: { createdAt: 'desc' } }),
    ]);
    const profesionales = recursos.map((r) => {
      const p = { servicios: r.comisionServicios.toNumber(), productos: r.comisionProductos.toNumber(), porSesion: r.comisionSesion.toNumber() };
      const propias = ventas.filter((v) => v.profesionalId === r.id);
      const l = liquidar(
        propias.map((v) => v.venta),
        sesiones.get(r.id) ?? 0,
        p,
      );
      const susPagos = pagos.filter((x) => x.recursoId === r.id);
      const pagado = susPagos.reduce((s, x) => s + x.monto.toNumber(), 0);
      return {
        id: r.id,
        nombre: r.nombre,
        color: r.color,
        usuarioId: r.usuarioId,
        porcentajes: p,
        ...l,
        pagado,
        pendiente: Math.round((l.total - pagado) * 100) / 100,
        ventas: propias.map((v) => ({ id: v.id, numero: v.numero, fecha: v.fecha, cliente: v.cliente, servicios: v.base.servicios, productos: v.base.productos, comision: Math.round(((v.base.servicios * p.servicios) / 100 + (v.base.productos * p.productos) / 100) * 100) / 100 })),
        pagos: susPagos.map((x) => ({ id: x.id, desde: fecha(x.desde), hasta: fecha(x.hasta), monto: x.monto.toNumber(), gastoId: x.gastoId, nota: x.nota, fecha: x.createdAt.toISOString() })),
      };
    });
    return { desde, hasta, profesionales };
  }

  /** Lo de cada uno: el profesional vinculado a mi usuario. */
  async mias(empresaId: string, usuarioId: string, desde: string, hasta: string) {
    const r = await this.prisma.agendaRecurso.findFirst({ where: { empresaId, usuarioId, deletedAt: null }, select: { id: true } });
    if (!r) return { desde, hasta, profesionales: [] };
    return this.liquidacion(empresaId, desde, hasta, r.id);
  }

  /** Ventas del período con algún servicio y sin profesional: para asignarlas. */
  async sinAsignar(empresaId: string, desde: string, hasta: string) {
    const ventas = await this.prisma.venta.findMany({
      where: { empresaId, deletedAt: null, profesionalId: null, fecha: this.rango(desde, hasta), items: { some: { producto: { esServicio: true } } } },
      select: { id: true, numeroVenta: true, fecha: true, clienteNombre: true, cliente: { select: { nombre: true } }, totalConInteres: true, totalSinInteres: true },
      orderBy: { fecha: 'desc' },
      take: 200,
    });
    return ventas.map((v) => ({ id: v.id, numero: v.numeroVenta, fecha: v.fecha.toISOString(), cliente: v.cliente?.nombre ?? v.clienteNombre, total: (v.totalSinInteres ?? v.totalConInteres)?.toNumber() ?? 0 }));
  }

  asignar(empresaId: string, ventaId: string, profesionalId: string | null) {
    return this.ventas.asignarProfesional(empresaId, ventaId, profesionalId);
  }

  async pagar(empresaId: string, usuarioId: string, input: PagoComisionInput) {
    const r = await this.prisma.agendaRecurso.findFirst({ where: { id: input.recursoId, empresaId }, select: { nombre: true } });
    if (!r) throw new NotFoundException('No encontramos ese profesional');
    if (input.desde > input.hasta) throw new BadRequestException('El "desde" tiene que ser antes del "hasta"');
    const pago = await this.prisma.$transaction(async (tx) => {
      const gasto = input.registrarGasto
        ? await tx.gasto.create({
            data: { empresaId, usuarioId, categoria: 'sueldos', descripcion: `Comisiones de ${r.nombre} (${diaMes(input.desde)} al ${diaMes(input.hasta)})`, monto: input.monto, fecha: dia(fechaHoyAR()), tipoCosto: 'variable' },
          })
        : null;
      return tx.comisionPago.create({ data: { empresaId, recursoId: input.recursoId, desde: dia(input.desde), hasta: dia(input.hasta), monto: input.monto, gastoId: gasto?.id ?? null, nota: input.nota?.trim() || null, usuarioId } });
    });
    return { id: pago.id };
  }

  /** Se cargó mal: se borra el pago y, si lo había, su gasto. */
  async anularPago(empresaId: string, id: string) {
    const pago = await this.prisma.comisionPago.findFirst({ where: { id, empresaId } });
    if (!pago) throw new NotFoundException('Pago no encontrado');
    await this.prisma.$transaction(async (tx) => {
      if (pago.gastoId) await tx.gasto.updateMany({ where: { id: pago.gastoId, empresaId }, data: { deletedAt: new Date() } });
      await tx.comisionPago.delete({ where: { id } });
    });
    return { ok: true };
  }
}

import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { fechaHoyAR } from '../analytics/analytics.util.js';
import { telefonoWhatsApp } from '../documentos/documentos.util.js';
import { VentasService } from '../ventas/ventas.service.js';
import { estadoAbono, finPeriodo, mensajeAbono, periodoVigente, proximoDesde, type EstadoAbono, type TipoAbono } from './abonos.util.js';

export interface PlanAbonoInput {
  nombre: string;
  tipo: TipoAbono;
  precio: number;
  sesiones?: number | null;
  vigenciaDias?: number | null;
  activo?: boolean;
  /** Al editar: llevar el precio nuevo a los abonos activos de este plan. */
  actualizarAbonos?: boolean;
}

export interface CobroAbonoInput {
  formaPago: string;
  /** Desde cuándo corre el período (por defecto, pegado al anterior o desde hoy). */
  desde?: string | null;
  cuotas?: number;
  coeficienteInteres?: number;
  ubicacionOrigen?: string | null;
}

const fecha = (d: Date) => d.toISOString().slice(0, 10);
const dia = (f: string) => new Date(`${f}T00:00:00Z`);

/**
 * Abonos (módulo de servicios, pieza 4, plan Pro): cuotas mensuales o paquetes de sesiones.
 * Cada cuota es una venta del servicio del plan (entra en la caja, los reportes y, si
 * queda a cuenta, en la cuenta corriente del cliente). Las sesiones se descuentan de a una.
 */
@Injectable()
export class AbonosService {
  private readonly logger = new Logger(AbonosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ventas: VentasService,
  ) {}

  // ---- Planes ----------------------------------------------------------------

  async planes(empresaId: string) {
    const [planes, activos] = await Promise.all([
      this.prisma.abonoPlan.findMany({ where: { empresaId, deletedAt: null }, orderBy: [{ activo: 'desc' }, { nombre: 'asc' }] }),
      this.prisma.abono.groupBy({ by: ['planId'], where: { empresaId, estado: 'activo' }, _count: true }),
    ]);
    return planes.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      tipo: p.tipo as TipoAbono,
      precio: p.precio.toNumber(),
      sesiones: p.sesiones,
      vigenciaDias: p.vigenciaDias,
      productoId: p.productoId,
      activo: p.activo,
      abonados: activos.find((a) => a.planId === p.id)?._count ?? 0,
    }));
  }

  private validarPlan(input: PlanAbonoInput) {
    if (input.tipo === 'paquete' && !input.sesiones) throw new BadRequestException('Un paquete necesita la cantidad de sesiones');
  }

  async crearPlan(empresaId: string, input: PlanAbonoInput) {
    this.validarPlan(input);
    const plan = await this.prisma.$transaction(async (tx) => {
      // El servicio con el que sale cada cuota en la venta (se crea solo).
      const producto = await tx.producto.create({ data: { empresaId, nombre: input.nombre.trim(), costo: 0, precioVenta: input.precio, esServicio: true, modoPrecio: 'fijo' } });
      return tx.abonoPlan.create({
        data: { empresaId, nombre: input.nombre.trim(), tipo: input.tipo, precio: input.precio, sesiones: input.sesiones ?? null, vigenciaDias: input.tipo === 'paquete' ? (input.vigenciaDias ?? null) : null, productoId: producto.id },
      });
    });
    return (await this.planes(empresaId)).find((p) => p.id === plan.id)!;
  }

  async editarPlan(empresaId: string, id: string, input: PlanAbonoInput) {
    this.validarPlan(input);
    const actual = await this.prisma.abonoPlan.findFirst({ where: { id, empresaId, deletedAt: null } });
    if (!actual) throw new NotFoundException('Plan no encontrado');
    await this.prisma.$transaction(async (tx) => {
      await tx.abonoPlan.update({
        where: { id },
        data: { nombre: input.nombre.trim(), tipo: input.tipo, precio: input.precio, sesiones: input.sesiones ?? null, vigenciaDias: input.tipo === 'paquete' ? (input.vigenciaDias ?? null) : null, activo: input.activo ?? actual.activo },
      });
      await tx.producto.updateMany({ where: { id: actual.productoId, empresaId }, data: { nombre: input.nombre.trim(), precioVenta: input.precio } });
      if (input.actualizarAbonos) await tx.abono.updateMany({ where: { empresaId, planId: id, estado: 'activo' }, data: { precio: input.precio } });
    });
    return (await this.planes(empresaId)).find((p) => p.id === id)!;
  }

  async borrarPlan(empresaId: string, id: string) {
    if (await this.prisma.abono.count({ where: { empresaId, planId: id, estado: 'activo' } })) throw new BadRequestException('Tiene abonados activos: dalos de baja o pasalos a otro plan antes de borrarlo');
    const { count } = await this.prisma.abonoPlan.updateMany({ where: { id, empresaId, deletedAt: null }, data: { deletedAt: new Date(), activo: false } });
    if (!count) throw new NotFoundException('Plan no encontrado');
    return { ok: true };
  }

  // ---- Abonos de los clientes ----------------------------------------------

  private async cargar(empresaId: string, where: Prisma.AbonoWhereInput) {
    const abonos = await this.prisma.abono.findMany({
      where: { empresaId, ...where },
      include: { plan: true, periodos: { orderBy: { desde: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    const ventaIds = abonos.flatMap((a) => a.periodos.map((p) => p.ventaId));
    const [clientes, ventas] = await Promise.all([
      this.prisma.cliente.findMany({ where: { empresaId, id: { in: [...new Set(abonos.map((a) => a.clienteId))] } }, select: { id: true, nombre: true, telefono: true } }),
      this.prisma.venta.findMany({ where: { id: { in: ventaIds } }, select: { id: true, numeroVenta: true, saldoPendiente: true, deletedAt: true } }),
    ]);
    const hoy = fechaHoyAR();
    return abonos.map((a) => {
      // Una cuota con la venta anulada no cuenta.
      const periodos = a.periodos
        .filter((p) => !ventas.find((v) => v.id === p.ventaId)?.deletedAt)
        .map((p) => {
          const v = ventas.find((x) => x.id === p.ventaId);
          return { id: p.id, desde: fecha(p.desde), hasta: fecha(p.hasta), sesiones: p.sesiones, usadas: p.usadas, monto: p.monto.toNumber(), ventaId: p.ventaId, numeroVenta: v?.numeroVenta ?? null, saldo: v?.saldoPendiente.toNumber() ?? 0 };
        });
      const estado = estadoAbono(hoy, a.estado === 'baja', periodos);
      const vigente = periodoVigente(hoy, periodos);
      const c = clientes.find((x) => x.id === a.clienteId);
      return {
        id: a.id,
        clienteId: a.clienteId,
        cliente: c?.nombre ?? '—',
        telefono: c?.telefono ?? null,
        planId: a.planId,
        plan: a.plan.nombre,
        tipo: a.plan.tipo as TipoAbono,
        precio: a.precio.toNumber(),
        estado,
        hasta: periodos.at(-1)?.hasta ?? null,
        sesionesRestantes: vigente && vigente.sesiones != null ? Math.max(0, vigente.sesiones - vigente.usadas) : null,
        deuda: periodos.reduce((s, p) => s + p.saldo, 0),
        notas: a.notas,
        alta: a.createdAt.toISOString(),
        periodos,
      };
    });
  }

  async listar(empresaId: string, filtro: EstadoAbono | 'todos' | 'con_deuda' = 'todos') {
    const todos = await this.cargar(empresaId, filtro === 'baja' ? { estado: 'baja' } : filtro === 'todos' ? {} : { estado: 'activo' });
    const activos = todos.filter((a) => a.estado !== 'baja');
    const filas = todos.filter((a) => filtro === 'todos' || (filtro === 'con_deuda' ? a.deuda > 0 : a.estado === filtro));
    const orden: Record<EstadoAbono, number> = { vencido: 0, sin_sesiones: 1, por_vencer: 2, sin_cobrar: 3, al_dia: 4, baja: 5 };
    return {
      resumen: {
        activos: activos.length,
        vencidos: activos.filter((a) => a.estado === 'vencido').length,
        porVencer: activos.filter((a) => a.estado === 'por_vencer' || a.estado === 'sin_sesiones').length,
        deuda: activos.reduce((s, a) => s + a.deuda, 0),
        // Lo que entra por mes si todos los mensuales renuevan.
        mensual: activos.filter((a) => a.tipo === 'mensual').reduce((s, a) => s + a.precio, 0),
      },
      filas: filas.sort((a, b) => orden[a.estado] - orden[b.estado] || a.cliente.localeCompare(b.cliente)).map(({ periodos: _p, ...f }) => f),
    };
  }

  async ficha(empresaId: string, id: string) {
    const [a] = await this.cargar(empresaId, { id });
    if (!a) throw new NotFoundException('Abono no encontrado');
    const usos = await this.prisma.abonoUso.findMany({ where: { empresaId, periodoId: { in: a.periodos.map((p) => p.id) } }, orderBy: { fecha: 'desc' }, take: 50 });
    return { ...a, proximoDesde: proximoDesde(fechaHoyAR(), a.hasta), usos: usos.map((u) => ({ id: u.id, fecha: u.fecha.toISOString(), periodoId: u.periodoId, turnoId: u.turnoId, nota: u.nota })) };
  }

  /** Abonos activos de un cliente (para la agenda: "usar una sesión del abono"). */
  async delCliente(empresaId: string, clienteId: string) {
    return (await this.cargar(empresaId, { clienteId, estado: 'activo' })).map(({ periodos: _p, ...a }) => a);
  }

  async crear(empresaId: string, usuarioId: string, input: { clienteId: string; planId: string; precio?: number | null; notas?: string | null; cobro?: CobroAbonoInput | null }) {
    const [cliente, plan] = await Promise.all([
      this.prisma.cliente.findFirst({ where: { id: input.clienteId, empresaId, deletedAt: null }, select: { id: true } }),
      this.prisma.abonoPlan.findFirst({ where: { id: input.planId, empresaId, deletedAt: null, activo: true } }),
    ]);
    if (!cliente) throw new BadRequestException('El cliente no existe en tu empresa');
    if (!plan) throw new BadRequestException('Ese plan no está disponible');
    const repetido = await this.prisma.abono.count({ where: { empresaId, clienteId: input.clienteId, planId: input.planId, estado: 'activo' } });
    if (repetido) throw new ConflictException('Ese cliente ya tiene este abono activo');
    const abono = await this.prisma.abono.create({ data: { empresaId, clienteId: input.clienteId, planId: plan.id, precio: input.precio ?? plan.precio, notas: input.notas?.trim() || null, usuarioId } });
    if (input.cobro) {
      try {
        return await this.cobrar(empresaId, usuarioId, abono.id, input.cobro);
      } catch (e) {
        // Si no se pudo cobrar, no queda un abono a medias.
        await this.prisma.abono.delete({ where: { id: abono.id } });
        throw e;
      }
    }
    return this.ficha(empresaId, abono.id);
  }

  async editar(empresaId: string, id: string, input: { precio: number; notas?: string | null }) {
    const { count } = await this.prisma.abono.updateMany({ where: { id, empresaId }, data: { precio: input.precio, notas: input.notas?.trim() || null } });
    if (!count) throw new NotFoundException('Abono no encontrado');
    return this.ficha(empresaId, id);
  }

  async baja(empresaId: string, id: string, activo: boolean) {
    const { count } = await this.prisma.abono.updateMany({ where: { id, empresaId }, data: activo ? { estado: 'activo', bajaEn: null } : { estado: 'baja', bajaEn: new Date() } });
    if (!count) throw new NotFoundException('Abono no encontrado');
    return this.ficha(empresaId, id);
  }

  /** Cobra un período: venta del servicio del plan (o a cuenta) y el período con sus sesiones. */
  async cobrar(empresaId: string, usuarioId: string, id: string, input: CobroAbonoInput) {
    const abono = await this.prisma.abono.findFirst({ where: { id, empresaId }, include: { plan: true } });
    if (!abono) throw new NotFoundException('Abono no encontrado');
    if (abono.estado === 'baja') throw new BadRequestException('El abono está dado de baja: reactivalo para cobrarlo');
    const actual = await this.ficha(empresaId, id);
    const desde = input.desde ?? actual.proximoDesde;
    const hasta = finPeriodo(abono.plan.tipo as TipoAbono, desde, abono.plan.vigenciaDias);
    if (actual.periodos.some((p) => p.desde <= hasta && desde <= p.hasta)) throw new ConflictException('Ese período se pisa con uno ya cobrado');

    const venta = await this.ventas.confirmar(empresaId, usuarioId, {
      items: [{ productoId: abono.plan.productoId, varianteId: null, cantidad: 1, precioUnitario: abono.precio.toNumber() }],
      formaPago: input.formaPago as never,
      descuento: 0,
      clienteNombre: null,
      clienteId: abono.clienteId,
      listaPrecioId: null,
      cuotas: input.cuotas ?? 1,
      coeficienteInteres: input.coeficienteInteres ?? 0,
      ubicacionOrigen: input.ubicacionOrigen ?? null,
      esSenia: false,
      montoSenia: 0,
    });
    try {
      await this.prisma.abonoPeriodo.create({ data: { empresaId, abonoId: id, desde: dia(desde), hasta: dia(hasta), sesiones: abono.plan.sesiones, monto: venta.total, ventaId: venta.id } });
    } catch (e) {
      this.logger.error(`Cobro del abono ${id}: ${(e as Error).message}. Se anula la venta ${venta.numeroVenta}.`);
      await this.ventas.anular(empresaId, usuarioId, venta.id, { motivo: 'Falló el cobro del abono' }).catch(() => undefined);
      throw e;
    }
    return this.ficha(empresaId, id);
  }

  /** Usa una sesión (o anota una asistencia) del período que corre hoy. Opcional: desde un turno de la agenda. */
  async usar(empresaId: string, usuarioId: string, id: string, input: { turnoId?: string | null; nota?: string | null }) {
    const a = await this.ficha(empresaId, id);
    if (a.estado === 'baja') throw new BadRequestException('El abono está dado de baja');
    const vigente = periodoVigente(fechaHoyAR(), a.periodos);
    if (!vigente) throw new BadRequestException(a.estado === 'vencido' ? 'El abono está vencido: renovalo para seguir usándolo' : 'El abono no tiene un período que corra hoy');
    if (input.turnoId) {
      const turno = await this.prisma.turno.findFirst({ where: { id: input.turnoId, empresaId }, select: { clienteId: true, ventaId: true } });
      if (!turno) throw new BadRequestException('El turno no existe en tu empresa');
      if (turno.clienteId !== a.clienteId) throw new BadRequestException('El turno es de otro cliente');
      if (turno.ventaId) throw new BadRequestException('El turno ya se cobró con una venta');
    }
    await this.prisma.$transaction(async (tx) => {
      // De a una y sin pasarse, aunque dos personas lo marquen a la vez.
      const n = await tx.$executeRaw`UPDATE abono_periodos SET usadas = usadas + 1 WHERE id = ${vigente.id}::uuid AND (sesiones IS NULL OR usadas < sesiones)`;
      if (!n) throw new BadRequestException('Ya usó todas las sesiones de este período: renovalo para seguir');
      try {
        await tx.abonoUso.create({ data: { empresaId, periodoId: vigente.id, turnoId: input.turnoId ?? null, usuarioId, nota: input.nota?.trim() || null } });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('Ese turno ya usó una sesión del abono');
        throw e;
      }
      if (input.turnoId) await tx.turno.update({ where: { id: input.turnoId }, data: { estado: 'atendido' } });
    });
    return this.ficha(empresaId, id);
  }

  /** Deshace un uso (se marcó por error): la sesión vuelve. */
  async deshacerUso(empresaId: string, id: string, usoId: string) {
    const uso = await this.prisma.abonoUso.findFirst({ where: { id: usoId, empresaId, periodo: { abonoId: id } } });
    if (!uso) throw new NotFoundException('Uso no encontrado');
    await this.prisma.$transaction([this.prisma.abonoUso.delete({ where: { id: usoId } }), this.prisma.abonoPeriodo.update({ where: { id: uso.periodoId }, data: { usadas: { decrement: 1 } } })]);
    return this.ficha(empresaId, id);
  }

  /** WhatsApp para el cliente según el estado (vence, venció, debe…). */
  async mensaje(empresaId: string, id: string) {
    const a = await this.ficha(empresaId, id);
    const empresa = await this.prisma.empresa.findUnique({ where: { id: empresaId }, select: { nombre: true } });
    const texto = mensajeAbono({ cliente: a.cliente, plan: a.plan, estado: a.estado, hasta: a.hasta, deuda: a.deuda, precio: a.precio, negocio: empresa?.nombre ?? '' });
    const telefono = telefonoWhatsApp(a.telefono);
    return { mensaje: texto, telefono, whatsapp: `https://wa.me/${telefono ?? ''}?text=${encodeURIComponent(texto)}` };
  }
}

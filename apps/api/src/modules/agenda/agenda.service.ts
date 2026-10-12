import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Turno } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { fechaHoyAR } from '../analytics/analytics.util.js';
import { telefonoWhatsApp } from '../documentos/documentos.util.js';
import {
  aHoraAR,
  dentroDelHorario,
  desdeHoraAR,
  DURACION_POR_DEFECTO,
  horariosLibres,
  mensajeRecordatorio,
  OCUPAN,
  validarHorarios,
  type EstadoTurno,
} from './agenda.util.js';

type Db = Prisma.TransactionClient | PrismaService;

export interface RecursoInput {
  nombre: string;
  usuarioId?: string | null;
  color?: string;
  online?: boolean;
  activo?: boolean;
  horarios: { diaSemana: number; desde: string; hasta: string }[];
}

export interface TurnoInput {
  recursoId: string;
  servicioId?: string | null;
  clienteId?: string | null;
  clienteNombre?: string | null;
  clienteTelefono?: string | null;
  /** "2026-10-15T15:30", hora de Argentina. */
  inicio: string;
  /** Si no viene, la duración del servicio (o 30 minutos). */
  duracionMin?: number | null;
  notas?: string | null;
  /** Agendar igual fuera de horario o en un día cerrado (solo en la agenda interna). */
  forzar?: boolean;
  origen?: 'interno' | 'online';
}

/**
 * Agenda y turnos (módulo de servicios, pieza 3, plan Pro). Dos turnos de un mismo
 * recurso no se pisan: el alta y la reprogramación toman un lock por recurso, así
 * dos personas que reservan el mismo horario a la vez no quedan las dos adentro.
 */
@Injectable()
export class AgendaService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Recursos (profesionales, sillones, canchas…) ----------------------

  async recursos(empresaId: string, soloActivos = false) {
    const filas = await this.prisma.agendaRecurso.findMany({
      where: { empresaId, deletedAt: null, ...(soloActivos ? { activo: true } : {}) },
      include: { horarios: { orderBy: [{ diaSemana: 'asc' }, { desde: 'asc' }] } },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    });
    return filas.map((r) => ({ id: r.id, nombre: r.nombre, usuarioId: r.usuarioId, color: r.color, online: r.online, activo: r.activo, horarios: r.horarios.map((h) => ({ diaSemana: h.diaSemana, desde: h.desde, hasta: h.hasta })) }));
  }

  private async validarRecurso(empresaId: string, input: RecursoInput) {
    const error = validarHorarios(input.horarios);
    if (error) throw new BadRequestException(error);
    if (input.usuarioId && !(await this.prisma.usuario.count({ where: { id: input.usuarioId, empresaId } }))) throw new BadRequestException('Ese usuario no es de tu empresa');
  }

  async crearRecurso(empresaId: string, input: RecursoInput) {
    await this.validarRecurso(empresaId, input);
    const orden = await this.prisma.agendaRecurso.count({ where: { empresaId, deletedAt: null } });
    const r = await this.prisma.agendaRecurso.create({
      data: { empresaId, nombre: input.nombre.trim(), usuarioId: input.usuarioId ?? null, color: input.color ?? '#6366f1', online: input.online ?? true, orden, horarios: { create: input.horarios } },
    });
    return (await this.recursos(empresaId)).find((x) => x.id === r.id)!;
  }

  async editarRecurso(empresaId: string, id: string, input: RecursoInput) {
    if (!(await this.prisma.agendaRecurso.count({ where: { id, empresaId, deletedAt: null } }))) throw new NotFoundException('No encontramos ese profesional o recurso');
    await this.validarRecurso(empresaId, input);
    await this.prisma.$transaction([
      this.prisma.agendaHorario.deleteMany({ where: { recursoId: id } }),
      this.prisma.agendaRecurso.update({
        where: { id },
        data: { nombre: input.nombre.trim(), usuarioId: input.usuarioId ?? null, color: input.color, online: input.online, activo: input.activo, horarios: { create: input.horarios } },
      }),
    ]);
    return (await this.recursos(empresaId)).find((x) => x.id === id)!;
  }

  async borrarRecurso(empresaId: string, id: string) {
    const futuros = await this.prisma.turno.count({ where: { empresaId, recursoId: id, inicio: { gte: new Date() }, estado: { in: [...OCUPAN] } } });
    if (futuros) throw new BadRequestException(`Tiene ${futuros} turnos por delante: reprogramalos o cancelalos antes de borrarlo`);
    const { count } = await this.prisma.agendaRecurso.updateMany({ where: { id, empresaId, deletedAt: null }, data: { deletedAt: new Date(), activo: false } });
    if (!count) throw new NotFoundException('No encontramos ese profesional o recurso');
    return { ok: true };
  }

  // ---- Días cerrados -----------------------------------------------------

  async bloqueos(empresaId: string, desde: string, hasta: string) {
    const filas = await this.prisma.agendaBloqueo.findMany({ where: { empresaId, fecha: { gte: new Date(`${desde}T00:00:00Z`), lte: new Date(`${hasta}T00:00:00Z`) } }, orderBy: { fecha: 'asc' } });
    return filas.map((b) => ({ id: b.id, recursoId: b.recursoId, fecha: b.fecha.toISOString().slice(0, 10), motivo: b.motivo }));
  }

  async crearBloqueo(empresaId: string, input: { fecha: string; recursoId?: string | null; motivo?: string | null }) {
    if (input.recursoId && !(await this.prisma.agendaRecurso.count({ where: { id: input.recursoId, empresaId } }))) throw new BadRequestException('No encontramos ese profesional o recurso');
    const b = await this.prisma.agendaBloqueo.create({ data: { empresaId, fecha: new Date(`${input.fecha}T00:00:00Z`), recursoId: input.recursoId ?? null, motivo: input.motivo?.trim() || null } });
    return { id: b.id };
  }

  async borrarBloqueo(empresaId: string, id: string) {
    await this.prisma.agendaBloqueo.deleteMany({ where: { id, empresaId } });
    return { ok: true };
  }

  // ---- Turnos ----------------------------------------------------------------

  private async vistas(empresaId: string, turnos: Turno[]) {
    const [recursos, servicios] = await Promise.all([
      this.prisma.agendaRecurso.findMany({ where: { empresaId, id: { in: [...new Set(turnos.map((t) => t.recursoId))] } }, select: { id: true, nombre: true, color: true } }),
      this.prisma.producto.findMany({ where: { empresaId, id: { in: [...new Set(turnos.map((t) => t.servicioId).filter((x): x is string => Boolean(x)))] } }, select: { id: true, nombre: true, precioVenta: true } }),
    ]);
    return turnos.map((t) => {
      const r = recursos.find((x) => x.id === t.recursoId);
      const s = servicios.find((x) => x.id === t.servicioId);
      return {
        id: t.id,
        recursoId: t.recursoId,
        recurso: r?.nombre ?? '',
        color: r?.color ?? '#6366f1',
        servicioId: t.servicioId,
        servicio: s?.nombre ?? null,
        precio: s?.precioVenta?.toNumber() ?? null,
        clienteId: t.clienteId,
        clienteNombre: t.clienteNombre,
        clienteTelefono: t.clienteTelefono,
        inicio: aHoraAR(t.inicio),
        fin: aHoraAR(t.fin),
        duracionMin: Math.round((t.fin.getTime() - t.inicio.getTime()) / 60_000),
        estado: t.estado as EstadoTurno,
        notas: t.notas,
        origen: t.origen,
        ventaId: t.ventaId,
        recordadoEn: t.recordadoEn?.toISOString() ?? null,
      };
    });
  }

  async turnos(empresaId: string, desde: string, hasta: string, recursoId?: string) {
    const filas = await this.prisma.turno.findMany({
      where: { empresaId, inicio: { gte: desdeHoraAR(`${desde}T00:00`), lt: new Date(desdeHoraAR(`${hasta}T00:00`).getTime() + 86_400_000) }, ...(recursoId ? { recursoId } : {}) },
      orderBy: { inicio: 'asc' },
    });
    return this.vistas(empresaId, filas);
  }

  private async turno(empresaId: string, id: string, db: Db = this.prisma) {
    const t = await db.turno.findFirst({ where: { id, empresaId } });
    if (!t) throw new NotFoundException('Turno no encontrado');
    return t;
  }

  /** Valida recurso, servicio, cliente, duración, horario y que no se pise con otro (dentro del lock). */
  private async preparar(tx: Prisma.TransactionClient, empresaId: string, input: TurnoInput, excluirId: string | null) {
    const recurso = await tx.agendaRecurso.findFirst({ where: { id: input.recursoId, empresaId, deletedAt: null }, include: { horarios: true } });
    if (!recurso || !recurso.activo) throw new BadRequestException('Ese profesional o recurso no está disponible');
    const servicio = input.servicioId ? await tx.producto.findFirst({ where: { id: input.servicioId, empresaId, deletedAt: null }, select: { nombre: true, duracionMin: true } }) : null;
    if (input.servicioId && !servicio) throw new BadRequestException('Ese servicio no existe en tu empresa');
    let clienteNombre = input.clienteNombre?.trim() || null;
    let clienteTelefono = input.clienteTelefono?.trim() || null;
    if (input.clienteId) {
      const c = await tx.cliente.findFirst({ where: { id: input.clienteId, empresaId, deletedAt: null }, select: { nombre: true, telefono: true } });
      if (!c) throw new BadRequestException('El cliente no existe en tu empresa');
      clienteNombre = c.nombre;
      clienteTelefono = clienteTelefono ?? c.telefono;
    }
    const duracion = input.duracionMin ?? servicio?.duracionMin ?? DURACION_POR_DEFECTO;
    const inicio = desdeHoraAR(input.inicio);
    const fin = new Date(inicio.getTime() + duracion * 60_000);
    if (!input.forzar || input.origen === 'online') {
      if (!dentroDelHorario(recurso.horarios, input.inicio, duracion)) throw new BadRequestException(`Ese horario está fuera de la atención de ${recurso.nombre}`);
      const cerrado = await tx.agendaBloqueo.count({ where: { empresaId, fecha: new Date(`${input.inicio.slice(0, 10)}T00:00:00Z`), OR: [{ recursoId: null }, { recursoId: recurso.id }] } });
      if (cerrado) throw new BadRequestException('Ese día está cerrado');
    }
    // Lock por recurso: el chequeo y el alta van juntos, sin que otro se cuele en el medio.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${recurso.id}))`;
    const pisado = await tx.turno.findFirst({
      where: { empresaId, recursoId: recurso.id, estado: { in: [...OCUPAN] }, inicio: { lt: fin }, fin: { gt: inicio }, ...(excluirId ? { id: { not: excluirId } } : {}) },
      select: { inicio: true, clienteNombre: true },
    });
    if (pisado) throw new ConflictException(`${recurso.nombre} ya tiene un turno a las ${aHoraAR(pisado.inicio).slice(11, 16)}${pisado.clienteNombre ? ` (${pisado.clienteNombre})` : ''}`);
    return { recursoId: recurso.id, servicioId: input.servicioId ?? null, clienteId: input.clienteId ?? null, clienteNombre, clienteTelefono, inicio, fin, notas: input.notas?.trim() || null };
  }

  async crearTurno(empresaId: string, usuarioId: string | null, input: TurnoInput) {
    if (!input.clienteId && !input.clienteNombre?.trim()) throw new BadRequestException('Cargá a quién es el turno');
    const t = await this.prisma.$transaction(async (tx) => {
      const datos = await this.preparar(tx, empresaId, input, null);
      return tx.turno.create({ data: { empresaId, usuarioId, origen: input.origen ?? 'interno', ...datos } });
    });
    return (await this.vistas(empresaId, [t]))[0];
  }

  async reprogramar(empresaId: string, id: string, input: Partial<TurnoInput>) {
    const actual = await this.turno(empresaId, id);
    if (!['reservado', 'confirmado'].includes(actual.estado)) throw new BadRequestException('Solo se reprograman los turnos reservados o confirmados');
    const t = await this.prisma.$transaction(async (tx) => {
      const datos = await this.preparar(
        tx,
        empresaId,
        {
          recursoId: input.recursoId ?? actual.recursoId,
          servicioId: input.servicioId !== undefined ? input.servicioId : actual.servicioId,
          clienteId: input.clienteId !== undefined ? input.clienteId : actual.clienteId,
          clienteNombre: input.clienteNombre !== undefined ? input.clienteNombre : actual.clienteNombre,
          clienteTelefono: input.clienteTelefono !== undefined ? input.clienteTelefono : actual.clienteTelefono,
          inicio: input.inicio ?? aHoraAR(actual.inicio),
          duracionMin: input.duracionMin ?? Math.round((actual.fin.getTime() - actual.inicio.getTime()) / 60_000),
          notas: input.notas !== undefined ? input.notas : actual.notas,
          forzar: input.forzar,
        },
        id,
      );
      return tx.turno.update({ where: { id }, data: { ...datos, recordadoEn: input.inicio && input.inicio !== aHoraAR(actual.inicio) ? null : actual.recordadoEn } });
    });
    return (await this.vistas(empresaId, [t]))[0];
  }

  async cambiarEstado(empresaId: string, id: string, estado: EstadoTurno) {
    const actual = await this.turno(empresaId, id);
    if (actual.ventaId) throw new BadRequestException('El turno ya se cobró');
    // Volver a ocuparlo (ej. de "cancelado" a "reservado") pide que el horario siga libre.
    if (OCUPAN.includes(estado) && !OCUPAN.includes(actual.estado as EstadoTurno)) {
      return this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${actual.recursoId}))`;
        const pisado = await tx.turno.count({ where: { empresaId, recursoId: actual.recursoId, id: { not: id }, estado: { in: [...OCUPAN] }, inicio: { lt: actual.fin }, fin: { gt: actual.inicio } } });
        if (pisado) throw new ConflictException('Ese horario ya lo tomó otro turno');
        const t = await tx.turno.update({ where: { id }, data: { estado } });
        return (await this.vistas(empresaId, [t]))[0];
      });
    }
    const t = await this.prisma.turno.update({ where: { id }, data: { estado } });
    return (await this.vistas(empresaId, [t]))[0];
  }

  /** Después de cobrarlo en Nueva venta: queda atendido y con su venta. */
  async marcarCobrado(empresaId: string, id: string, ventaId: string) {
    const actual = await this.turno(empresaId, id);
    if (actual.ventaId === ventaId) return (await this.vistas(empresaId, [actual]))[0];
    if (actual.ventaId) throw new ConflictException('El turno ya se cobró con otra venta');
    if (!(await this.prisma.venta.count({ where: { id: ventaId, empresaId, deletedAt: null } }))) throw new BadRequestException('La venta no existe en tu empresa');
    const t = await this.prisma.turno.update({ where: { id }, data: { estado: 'atendido', ventaId } });
    return (await this.vistas(empresaId, [t]))[0];
  }

  /** Mensaje y link de WhatsApp para recordarle el turno (queda marcado como recordado). */
  async recordatorio(empresaId: string, id: string) {
    const t = await this.turno(empresaId, id);
    const [v] = await this.vistas(empresaId, [t]);
    const empresa = await this.prisma.empresa.findUnique({ where: { id: empresaId }, select: { nombre: true } });
    const mensaje = mensajeRecordatorio({ cliente: v.clienteNombre, servicio: v.servicio, profesional: v.recurso, inicio: t.inicio, negocio: empresa?.nombre ?? '' });
    const telefono = telefonoWhatsApp(t.clienteTelefono);
    await this.prisma.turno.update({ where: { id }, data: { recordadoEn: new Date() } });
    return { mensaje, telefono, whatsapp: `https://wa.me/${telefono ?? ''}?text=${encodeURIComponent(mensaje)}` };
  }

  /** Horarios libres de un recurso en un día (para la reserva online y para ayudar al cargar). */
  async libres(empresaId: string, recursoId: string, fecha: string, duracionMin?: number, servicioId?: string) {
    const recurso = await this.prisma.agendaRecurso.findFirst({ where: { id: recursoId, empresaId, deletedAt: null, activo: true }, include: { horarios: true } });
    if (!recurso) throw new NotFoundException('No encontramos ese profesional o recurso');
    const servicio = servicioId ? await this.prisma.producto.findFirst({ where: { id: servicioId, empresaId }, select: { duracionMin: true } }) : null;
    const duracion = duracionMin ?? servicio?.duracionMin ?? DURACION_POR_DEFECTO;
    const [ocupados, cerrado] = await Promise.all([
      this.prisma.turno.findMany({ where: { recursoId, estado: { in: [...OCUPAN] }, inicio: { lt: new Date(desdeHoraAR(`${fecha}T00:00`).getTime() + 86_400_000) }, fin: { gt: desdeHoraAR(`${fecha}T00:00`) } }, select: { inicio: true, fin: true } }),
      this.prisma.agendaBloqueo.count({ where: { empresaId, fecha: new Date(`${fecha}T00:00:00Z`), OR: [{ recursoId: null }, { recursoId }] } }),
    ]);
    return { fecha, duracionMin: duracion, libres: horariosLibres({ fecha, horarios: recurso.horarios, ocupados, duracion, ahora: fecha === fechaHoyAR() ? new Date() : undefined, cerrado: cerrado > 0 }) };
  }
}

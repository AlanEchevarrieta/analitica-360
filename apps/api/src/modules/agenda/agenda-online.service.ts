import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { fechaHoyAR } from '../analytics/analytics.util.js';
import { AccesoCuentaService } from '../planes/acceso-cuenta.service.js';
import { AgendaService } from './agenda.service.js';
import { cuandoTexto, desdeHoraAR, DURACION_POR_DEFECTO, horariosLibres, OCUPAN } from './agenda.util.js';

export interface ConfigAgendaInput {
  reservaOnline: boolean;
  anticipacionMin: number;
  diasMaximo: number;
  mensaje?: string | null;
}

export interface ReservaOnlineInput {
  servicioId: string;
  /** null = "con quien esté libre". */
  recursoId?: string | null;
  fecha: string;
  hora: string;
  nombre: string;
  telefono: string;
  notas?: string | null;
}

const POR_DEFECTO = { reservaOnline: false, anticipacionMin: 120, diasMaximo: 30, mensaje: null as string | null };

/**
 * Reserva online de turnos desde la tienda (módulo de servicios, pieza 3, parte 2).
 * Público (sin sesión): solo muestra servicios y profesionales marcados para la web,
 * y los turnos entran con origen "online" respetando horarios, días cerrados y anticipación.
 */
@Injectable()
export class AgendaOnlineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agenda: AgendaService,
    private readonly acceso: AccesoCuentaService,
  ) {}

  async config(empresaId: string) {
    const c = await this.prisma.agendaConfig.findUnique({ where: { empresaId } });
    return c ? { reservaOnline: c.reservaOnline, anticipacionMin: c.anticipacionMin, diasMaximo: c.diasMaximo, mensaje: c.mensaje } : { ...POR_DEFECTO };
  }

  async guardarConfig(empresaId: string, input: ConfigAgendaInput) {
    const data = { reservaOnline: input.reservaOnline, anticipacionMin: input.anticipacionMin, diasMaximo: input.diasMaximo, mensaje: input.mensaje?.trim() || null };
    await this.prisma.agendaConfig.upsert({ where: { empresaId }, create: { empresaId, ...data }, update: data });
    return this.config(empresaId);
  }

  /** ¿La tienda ofrece reservar turnos? (plan con agenda, tienda activa y la opción prendida). */
  async habilitada(empresaId: string) {
    const [config, tienda] = await Promise.all([this.config(empresaId), this.prisma.tiendaConfig.count({ where: { empresaId, activa: true } })]);
    if (!config.reservaOnline || !tienda) return null;
    const plan = await this.acceso.planDe(empresaId);
    return plan.funciones.includes('agenda') ? config : null;
  }

  private async exigir(empresaId: string) {
    const config = await this.habilitada(empresaId);
    if (!config) throw new NotFoundException('Este negocio no toma turnos online');
    return config;
  }

  private profesionales(empresaId: string) {
    return this.prisma.agendaRecurso.findMany({ where: { empresaId, deletedAt: null, activo: true, online: true }, include: { horarios: true }, orderBy: [{ orden: 'asc' }, { nombre: 'asc' }] });
  }

  /** Lo que la tienda necesita para armar la reserva. */
  async opciones(empresaId: string) {
    const config = await this.habilitada(empresaId);
    if (!config) return { activa: false as const };
    const [servicios, profesionales] = await Promise.all([
      this.prisma.producto.findMany({ where: { empresaId, esServicio: true, activo: true, deletedAt: null }, select: { id: true, nombre: true, duracionMin: true, precioVenta: true, modoPrecio: true }, orderBy: { nombre: 'asc' } }),
      this.profesionales(empresaId),
    ]);
    return {
      activa: true as const,
      diasMaximo: config.diasMaximo,
      mensaje: config.mensaje,
      hoy: fechaHoyAR(),
      servicios: servicios.map((s) => ({ id: s.id, nombre: s.nombre, duracionMin: s.duracionMin ?? DURACION_POR_DEFECTO, precio: s.modoPrecio === 'fijo' ? (s.precioVenta?.toNumber() ?? null) : null, modoPrecio: s.modoPrecio })),
      profesionales: profesionales.filter((p) => p.horarios.length > 0).map((p) => ({ id: p.id, nombre: p.nombre, color: p.color })),
    };
  }

  private async servicio(empresaId: string, servicioId: string) {
    const s = await this.prisma.producto.findFirst({ where: { id: servicioId, empresaId, esServicio: true, activo: true, deletedAt: null }, select: { id: true, nombre: true, duracionMin: true } });
    if (!s) throw new BadRequestException('Ese servicio no está disponible');
    return { ...s, duracion: s.duracionMin ?? DURACION_POR_DEFECTO };
  }

  private validarFecha(fecha: string, diasMaximo: number) {
    const hoy = fechaHoyAR();
    const tope = new Date(`${hoy}T00:00:00Z`);
    tope.setUTCDate(tope.getUTCDate() + diasMaximo);
    if (fecha < hoy || fecha > tope.toISOString().slice(0, 10)) throw new BadRequestException(`Se puede reservar desde hoy y hasta ${diasMaximo} días para adelante`);
  }

  /** Horarios libres de un día: de un profesional o de cualquiera (cada hora con quiénes la tienen libre). */
  async libres(empresaId: string, fecha: string, servicioId: string, recursoId?: string | null) {
    const config = await this.exigir(empresaId);
    this.validarFecha(fecha, config.diasMaximo);
    const servicio = await this.servicio(empresaId, servicioId);
    const todos = await this.profesionales(empresaId);
    const elegidos = recursoId ? todos.filter((p) => p.id === recursoId) : todos;
    if (recursoId && !elegidos.length) throw new BadRequestException('Ese profesional no toma turnos online');
    const dia = desdeHoraAR(`${fecha}T00:00`);
    const [ocupados, cerrados] = await Promise.all([
      this.prisma.turno.findMany({ where: { empresaId, recursoId: { in: elegidos.map((p) => p.id) }, estado: { in: [...OCUPAN] }, inicio: { lt: new Date(dia.getTime() + 86_400_000) }, fin: { gt: dia } }, select: { recursoId: true, inicio: true, fin: true } }),
      this.prisma.agendaBloqueo.findMany({ where: { empresaId, fecha: new Date(`${fecha}T00:00:00Z`) }, select: { recursoId: true } }),
    ]);
    const ahora = new Date(Date.now() + config.anticipacionMin * 60_000);
    const porHora = new Map<string, string[]>();
    for (const p of elegidos) {
      const cerrado = cerrados.some((b) => b.recursoId === null || b.recursoId === p.id);
      const horas = horariosLibres({ fecha, horarios: p.horarios, ocupados: ocupados.filter((o) => o.recursoId === p.id), duracion: servicio.duracion, paso: Math.min(30, servicio.duracion), ahora, cerrado });
      for (const h of horas) porHora.set(h, [...(porHora.get(h) ?? []), p.id]);
    }
    return { fecha, duracionMin: servicio.duracion, libres: [...porHora.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([hora, profesionales]) => ({ hora, profesionales })) };
  }

  /** Reserva del cliente. Si eligió "cualquiera", se le da al primero que lo tenga libre. */
  async reservar(empresaId: string, input: ReservaOnlineInput, clienteId: string | null) {
    const config = await this.exigir(empresaId);
    this.validarFecha(input.fecha, config.diasMaximo);
    const servicio = await this.servicio(empresaId, input.servicioId);
    const inicio = desdeHoraAR(`${input.fecha}T${input.hora}`);
    if (inicio.getTime() < Date.now() + config.anticipacionMin * 60_000) {
      throw new BadRequestException(`Los turnos online se reservan con al menos ${config.anticipacionMin >= 60 ? `${Math.round(config.anticipacionMin / 60)} h` : `${config.anticipacionMin} minutos`} de anticipación`);
    }
    const disponibles = (await this.libres(empresaId, input.fecha, input.servicioId, input.recursoId)).libres.find((l) => l.hora === input.hora)?.profesionales ?? [];
    if (!disponibles.length) throw new ConflictException('Ese horario ya no está libre. Elegí otro, por favor.');
    for (const recursoId of disponibles) {
      try {
        const t = await this.agenda.crearTurno(empresaId, null, {
          recursoId,
          servicioId: servicio.id,
          clienteId,
          clienteNombre: input.nombre,
          clienteTelefono: input.telefono,
          inicio: `${input.fecha}T${input.hora}`,
          duracionMin: servicio.duracion,
          notas: input.notas ?? null,
          origen: 'online',
        });
        return { id: t.id, servicio: servicio.nombre, profesional: t.recurso, inicio: t.inicio, fin: t.fin, cuando: cuandoTexto(inicio), mensaje: config.mensaje };
      } catch (e) {
        // Otro lo tomó en el medio: probamos con el siguiente profesional libre.
        if (!(e instanceof ConflictException)) throw e;
      }
    }
    throw new ConflictException('Ese horario ya no está libre. Elegí otro, por favor.');
  }
}

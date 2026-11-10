import { Injectable, Logger, NotFoundException, type OnModuleInit } from '@nestjs/common';
import { Prisma, type Evento } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { CorreoService, type EnviarCorreoInput } from './correo.service.js';
import { esErrorTemporal, espera, recortarTexto, vencioEsperaSinServicio, type EstadoEvento, type TipoEvento } from './eventos.util.js';

export type DbCliente = Prisma.TransactionClient | PrismaService;

export interface ResultadoManejador {
  /** 'ok' | 'omitido' | 'sin_servicio' (reintenta cada 24h sin gastar intentos normales hasta 35 días). */
  resultado?: 'ok' | 'omitido' | 'sin_servicio';
  detalle?: string;
}

export type ManejadorEvento<T = unknown> = (evento: Evento, payload: T) => Promise<ResultadoManejador | void>;

export class ErrorEventoDefinitivo extends Error {
  readonly definitivo = true;
  constructor(message: string) {
    super(message);
    this.name = 'ErrorEventoDefinitivo';
  }
}

const TIMEOUT_EVENTO_MS = 60_000;
const ESPERA_SIN_SERVICIO_MS = 24 * 3_600_000;

@Injectable()
export class EventosService implements OnModuleInit {
  private readonly logger = new Logger('Eventos');
  private readonly manejadores = new Map<string, ManejadorEvento>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly correo: CorreoService,
  ) {}

  onModuleInit() {
    // Manejador base: correo.enviar (un evento por destinatario para reintentar solo al que falló).
    this.registrar<EnviarCorreoInput>('correo.enviar', async (ev, payload) => {
      const res = await this.correo.enviar(payload);
      if (res.ok) {
        const dest = Array.isArray(payload.para) ? payload.para.join(', ') : payload.para;
        return { resultado: 'ok', detalle: `email a ${dest}` };
      }
      if (res.sinClave) {
        return { resultado: 'sin_servicio', detalle: res.error };
      }
      if (!res.temporal) {
        throw new ErrorEventoDefinitivo(res.error);
      }
      throw new Error(res.error);
    });
  }

  /** Registra el manejador que ejecuta un tipo de evento cuando el trabajador lo toma. */
  registrar<T = unknown>(tipo: TipoEvento | string, fn: ManejadorEvento<T>) {
    this.manejadores.set(tipo, fn as ManejadorEvento);
  }

  /**
   * Guarda un evento en la cola (dentro de la misma transacción `db` si se pasa).
   * Si trae `clave`, evita duplicados para el mismo `(empresaId, tipo, clave)` y devuelve `null` si ya existía.
   */
  async emitir(
    db: DbCliente,
    e: {
      empresaId: string | null;
      tipo: TipoEvento | string;
      payload: object;
      clave?: string | null;
      disponibleDesde?: Date;
      maxIntentos?: number;
    },
  ): Promise<{ id: string } | null> {
    const clave = e.clave?.trim() || null;
    const disponible = e.disponibleDesde ?? new Date();
    const maxIntentos = e.maxIntentos ?? 6;
    const payloadJson = JSON.stringify(e.payload ?? {});

    // En Postgres, UNIQUE(empresa_id, tipo, clave) con empresa_id IS NULL no choca solo:
    // verificamos antes si es un evento del sistema con clave.
    if (e.empresaId === null && clave) {
      const existente = await db.evento.findFirst({
        where: { empresaId: null, tipo: e.tipo, clave },
        select: { id: true },
      });
      if (existente) return null;
    }

    const filas = await db.$queryRaw<{ id: string }[]>(Prisma.sql`
      INSERT INTO eventos (id, empresa_id, tipo, payload, clave, estado, intentos, max_intentos, disponible_desde, creado_en)
      VALUES (
        gen_random_uuid(),
        ${e.empresaId}::uuid,
        ${e.tipo},
        ${payloadJson}::jsonb,
        ${clave},
        'pendiente',
        0,
        ${maxIntentos},
        ${disponible},
        now()
      )
      ON CONFLICT (empresa_id, tipo, clave) DO NOTHING
      RETURNING id
    `);

    return filas[0] ? { id: filas[0].id } : null;
  }

  /** Atajo para encolar un email por destinatario. */
  async emitirCorreo(
    db: DbCliente,
    empresaId: string | null,
    correo: EnviarCorreoInput,
    claveBase?: string,
  ): Promise<number> {
    const destinatarios = (Array.isArray(correo.para) ? correo.para : [correo.para])
      .map((d) => d.trim().toLowerCase())
      .filter((d) => d.includes('@'));
    let emitidos = 0;
    for (const para of new Set(destinatarios)) {
      const clave = claveBase ? `${claveBase}:${para}` : null;
      const r = await this.emitir(db, {
        empresaId,
        tipo: 'correo.enviar',
        payload: { ...correo, para },
        clave,
      });
      if (r) emitidos++;
    }
    return emitidos;
  }

  /**
   * Reserva hasta `limite` eventos listos para procesar usando `FOR UPDATE SKIP LOCKED`.
   * Seguro con múltiples instancias corriendo en paralelo.
   */
  async tomarLote(limite = 20, ahora: Date = new Date()): Promise<Evento[]> {
    return this.prisma.$queryRaw<Evento[]>(Prisma.sql`
      UPDATE eventos
      SET estado = 'procesando',
          intentos = intentos + 1,
          bloqueado_hasta = ${new Date(ahora.getTime() + 5 * 60_000)}
      WHERE id IN (
        SELECT id FROM eventos
        WHERE (estado = 'pendiente' AND disponible_desde <= ${ahora})
           OR (estado = 'procesando' AND bloqueado_hasta < ${ahora})
        ORDER BY disponible_desde ASC
        LIMIT ${limite}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING
        id,
        empresa_id AS "empresaId",
        tipo,
        payload,
        clave,
        estado,
        intentos,
        max_intentos AS "maxIntentos",
        disponible_desde AS "disponibleDesde",
        bloqueado_hasta AS "bloqueadoHasta",
        ultimo_error AS "ultimoError",
        creado_en AS "creadoEn",
        procesado_en AS "procesadoEn"
    `);
  }

  /** Procesa un lote de eventos reservados y registra cada intento en `eventos_ejecuciones`. */
  async procesarCiclo(ahora: Date = new Date()): Promise<number> {
    const lote = await this.tomarLote(20, ahora);
    for (const ev of lote) {
      await this.ejecutarUno(ev, ahora);
    }
    return lote.length;
  }

  async ejecutarUno(ev: Evento, ahora: Date = new Date()): Promise<void> {
    const inicio = Date.now();
    const manejador = this.manejadores.get(ev.tipo);
    if (!manejador) {
      await this.finalizarIntento(ev, {
        estadoEvento: 'fallo',
        resultadoEjecucion: 'error',
        error: `No hay manejador registrado para el tipo "${ev.tipo}"`,
        duracionMs: Date.now() - inicio,
        ahora,
      });
      return;
    }

    try {
      const res = await conTimeout(manejador(ev, ev.payload), TIMEOUT_EVENTO_MS);
      const duracionMs = Date.now() - inicio;

      if (res && res.resultado === 'sin_servicio') {
        if (vencioEsperaSinServicio(new Date(ev.creadoEn), ahora)) {
          await this.finalizarIntento(ev, {
            estadoEvento: 'descartado',
            resultadoEjecucion: 'omitido',
            detalle: 'Descartado por superar 35 días sin servicio de correo',
            error: res.detalle ?? null,
            duracionMs,
            ahora,
          });
        } else {
          // Queda pendiente para mañana sin gastar el tope de intentos normales.
          await this.prisma.$transaction([
            this.prisma.evento.update({
              where: { id: ev.id },
              data: {
                estado: 'pendiente',
                intentos: Math.max(0, ev.intentos - 1),
                bloqueadoHasta: null,
                disponibleDesde: new Date(ahora.getTime() + ESPERA_SIN_SERVICIO_MS),
                ultimoError: recortarTexto(res.detalle ?? 'Sin clave RESEND_API_KEY'),
              },
            }),
            this.prisma.eventoEjecucion.create({
              data: {
                eventoId: ev.id,
                intento: ev.intentos,
                resultado: 'omitido',
                detalle: recortarTexto(res.detalle ?? 'Sin clave RESEND_API_KEY', 500),
                duracionMs,
              },
            }),
          ]);
        }
        return;
      }

      const resultadoEjecucion = res?.resultado === 'omitido' ? 'omitido' : 'ok';
      await this.finalizarIntento(ev, {
        estadoEvento: 'hecho',
        resultadoEjecucion,
        detalle: res?.detalle ?? null,
        duracionMs,
        ahora,
      });
    } catch (e) {
      const duracionMs = Date.now() - inicio;
      const msg = (e as Error)?.message ?? String(e);
      const definitivo = e instanceof ErrorEventoDefinitivo || !esErrorTemporal({ mensaje: msg });
      const agotoIntentos = ev.intentos >= ev.maxIntentos;

      if (definitivo || agotoIntentos) {
        await this.finalizarIntento(ev, {
          estadoEvento: 'fallo',
          resultadoEjecucion: 'error',
          error: msg,
          duracionMs,
          ahora,
        });
      } else {
        const demora = espera(ev.intentos);
        await this.prisma.$transaction([
          this.prisma.evento.update({
            where: { id: ev.id },
            data: {
              estado: 'pendiente',
              bloqueadoHasta: null,
              disponibleDesde: new Date(ahora.getTime() + demora),
              ultimoError: recortarTexto(msg, 1000),
            },
          }),
          this.prisma.eventoEjecucion.create({
            data: {
              eventoId: ev.id,
              intento: ev.intentos,
              resultado: 'error',
              error: recortarTexto(msg, 1000),
              duracionMs,
            },
          }),
        ]);
      }
    }
  }

  private async finalizarIntento(
    ev: Evento,
    datos: {
      estadoEvento: 'hecho' | 'fallo' | 'descartado';
      resultadoEjecucion: 'ok' | 'error' | 'omitido';
      detalle?: string | null;
      error?: string | null;
      duracionMs: number;
      ahora: Date;
    },
  ) {
    await this.prisma.$transaction([
      this.prisma.evento.update({
        where: { id: ev.id },
        data: {
          estado: datos.estadoEvento,
          bloqueadoHasta: null,
          procesadoEn: datos.ahora,
          ultimoError: datos.error ? recortarTexto(datos.error, 1000) : null,
        },
      }),
      this.prisma.eventoEjecucion.create({
        data: {
          eventoId: ev.id,
          intento: ev.intentos,
          resultado: datos.resultadoEjecucion,
          detalle: recortarTexto(datos.detalle, 500),
          error: recortarTexto(datos.error, 1000),
          duracionMs: datos.duracionMs,
        },
      }),
    ]);
  }

  /** Limpieza diaria: borra hechos de >30 días y en fallo/descartados de >90 días. */
  async limpiarAntiguos(ahora: Date = new Date()): Promise<{ hechos: number; fallos: number }> {
    const hace30 = new Date(ahora.getTime() - 30 * 86_400_000);
    const hace90 = new Date(ahora.getTime() - 90 * 86_400_000);
    const [rHechos, rFallos] = await Promise.all([
      this.prisma.evento.deleteMany({
        where: { estado: 'hecho', creadoEn: { lt: hace30 } },
      }),
      this.prisma.evento.deleteMany({
        where: { estado: { in: ['fallo', 'descartado'] }, creadoEn: { lt: hace90 } },
      }),
    ]);
    return { hechos: rHechos.count, fallos: rFallos.count };
  }

  // ---- Consola de administración (/admin/eventos) ----

  async listarAdmin(filtros: { estado?: EstadoEvento; tipo?: string; empresaId?: string }) {
    const filas = await this.prisma.evento.findMany({
      where: {
        ...(filtros.estado ? { estado: filtros.estado } : {}),
        ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
        ...(filtros.empresaId ? { empresaId: filtros.empresaId } : {}),
      },
      orderBy: { creadoEn: 'desc' },
      take: 100,
      include: {
        ejecuciones: { orderBy: { intento: 'desc' }, take: 5 },
      },
    });
    const empresaIds = [...new Set(filas.map((f) => f.empresaId).filter((x): x is string => Boolean(x)))];
    const empresas = empresaIds.length
      ? await this.prisma.empresa.findMany({ where: { id: { in: empresaIds } }, select: { id: true, nombre: true } })
      : [];
    const nombreDe = new Map(empresas.map((e) => [e.id, e.nombre]));
    return filas.map((f) => ({
      ...f,
      empresaNombre: f.empresaId ? (nombreDe.get(f.empresaId) ?? 'Empresa') : 'Sistema',
    }));
  }

  async resumenAdmin(ahora: Date = new Date()) {
    const hace24h = new Date(ahora.getTime() - 86_400_000);
    const [pendientes, procesando, fallosTotal, fallos24h, hechos24h, porTipo] = await Promise.all([
      this.prisma.evento.count({ where: { estado: 'pendiente' } }),
      this.prisma.evento.count({ where: { estado: 'procesando' } }),
      this.prisma.evento.count({ where: { estado: 'fallo' } }),
      this.prisma.evento.count({ where: { estado: 'fallo', procesadoEn: { gte: hace24h } } }),
      this.prisma.evento.count({ where: { estado: 'hecho', procesadoEn: { gte: hace24h } } }),
      this.prisma.evento.groupBy({
        by: ['tipo', 'estado'],
        _count: { _all: true },
      }),
    ]);

    return {
      pendientes: pendientes + procesando,
      fallos: fallosTotal,
      fallos24h,
      hechos24h,
      porTipo: porTipo.map((g) => ({
        tipo: g.tipo,
        estado: g.estado,
        cantidad: g._count._all,
      })),
    };
  }

  async reintentarAdmin(id: string) {
    const ev = await this.prisma.evento.findUnique({ where: { id } });
    if (!ev) throw new NotFoundException('Evento no encontrado');
    return this.prisma.evento.update({
      where: { id },
      data: {
        estado: 'pendiente',
        intentos: 0,
        disponibleDesde: new Date(),
        bloqueadoHasta: null,
        ultimoError: null,
      },
    });
  }

  async descartarAdmin(id: string) {
    const ev = await this.prisma.evento.findUnique({ where: { id } });
    if (!ev) throw new NotFoundException('Evento no encontrado');
    return this.prisma.evento.update({
      where: { id },
      data: {
        estado: 'descartado',
        bloqueadoHasta: null,
        procesadoEn: new Date(),
      },
    });
  }
}

function conTimeout<T>(promesa: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Tiempo de espera agotado (${Math.round(ms / 1000)}s)`)), ms);
    timer.unref?.();
    promesa.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import type { EventosUsoDto, UsoQuery } from './uso.dto.js';
import { desdeDias, normalizarObjetivo, normalizarRuta } from './uso.util.js';

const RETENCION_DIAS = 180;
const HORA = 3_600_000;
const n = (x: bigint | number | null) => Number(x ?? 0);

/**
 * Uso de la app: qué pantallas abre y qué botones toca cada usuario.
 * Lo ve solo el administrador de la app (consola → Uso).
 */
@Injectable()
export class UsoService {
  private readonly logger = new Logger(UsoService.name);
  constructor(private readonly prisma: PrismaService) {}

  async registrar(empresaId: string, usuarioId: string, dto: EventosUsoDto) {
    const ahora = Date.now();
    await this.prisma.eventoUso.createMany({
      data: dto.eventos.map((e) => ({
        empresaId,
        usuarioId,
        sesion: dto.sesion,
        dispositivo: dto.dispositivo ?? null,
        tipo: e.tipo,
        ruta: normalizarRuta(e.ruta),
        objetivo: e.tipo === 'clic' ? normalizarObjetivo(e.objetivo) : null,
        // La hora del navegador, pero sin creerle fechas futuras ni muy viejas.
        creadoEn: new Date(Math.min(ahora, Math.max(ahora - HORA, e.en ?? ahora))),
      })),
    });
    // Limpieza de lo viejo de vez en cuando (no hace falta un cron para esto).
    if (Math.random() < 0.01) {
      this.prisma.eventoUso
        .deleteMany({ where: { creadoEn: { lt: desdeDias(RETENCION_DIAS) } } })
        .catch((e: unknown) => this.logger.warn(`No se pudo limpiar eventos de uso: ${String(e)}`));
    }
  }

  private filtro(q: UsoQuery, usuarioId?: string) {
    return Prisma.sql`e.creado_en >= ${desdeDias(q.dias)}
      ${q.empresaId ? Prisma.sql`AND e.empresa_id = ${q.empresaId}::uuid` : Prisma.empty}
      ${usuarioId ? Prisma.sql`AND e.usuario_id = ${usuarioId}::uuid` : Prisma.empty}
      ${q.conAdmins ? Prisma.empty : Prisma.sql`AND NOT EXISTS (SELECT 1 FROM admin_emails a WHERE lower(a.email) = lower(u.email))`}`;
  }

  private readonly desde = Prisma.sql`FROM eventos_uso e JOIN usuarios u ON u.id = e.usuario_id`;

  private pantallas(where: Prisma.Sql, limite: number) {
    return this.prisma.$queryRaw<{ ruta: string; vistas: bigint; usuarios: bigint; empresas: bigint }[]>(Prisma.sql`
      SELECT e.ruta, count(*) AS vistas, count(DISTINCT e.usuario_id) AS usuarios, count(DISTINCT e.empresa_id) AS empresas
      ${this.desde} WHERE ${where} AND e.tipo = 'vista' GROUP BY e.ruta ORDER BY vistas DESC LIMIT ${limite}`);
  }

  private clics(where: Prisma.Sql, limite: number) {
    return this.prisma.$queryRaw<{ objetivo: string; ruta: string; veces: bigint; usuarios: bigint }[]>(Prisma.sql`
      SELECT e.objetivo, e.ruta, count(*) AS veces, count(DISTINCT e.usuario_id) AS usuarios
      ${this.desde} WHERE ${where} AND e.tipo = 'clic' AND e.objetivo IS NOT NULL
      GROUP BY e.objetivo, e.ruta ORDER BY veces DESC LIMIT ${limite}`);
  }

  /** Todo el tablero: totales, por día, pantallas, botones, usuarios y dispositivos. */
  async resumen(q: UsoQuery) {
    const where = this.filtro(q);
    const [tot, dias, pantallas, clics, usuarios, dispositivos] = await Promise.all([
      this.prisma.$queryRaw<{ usuarios: bigint; empresas: bigint; sesiones: bigint; vistas: bigint; clics: bigint }[]>(Prisma.sql`
        SELECT count(DISTINCT e.usuario_id) AS usuarios, count(DISTINCT e.empresa_id) AS empresas, count(DISTINCT e.sesion) AS sesiones,
          count(*) FILTER (WHERE e.tipo = 'vista') AS vistas, count(*) FILTER (WHERE e.tipo = 'clic') AS clics
        ${this.desde} WHERE ${where}`),
      this.prisma.$queryRaw<{ dia: Date; usuarios: bigint; vistas: bigint; clics: bigint }[]>(Prisma.sql`
        SELECT date_trunc('day', e.creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires') AS dia,
          count(DISTINCT e.usuario_id) AS usuarios, count(*) FILTER (WHERE e.tipo = 'vista') AS vistas, count(*) FILTER (WHERE e.tipo = 'clic') AS clics
        ${this.desde} WHERE ${where} GROUP BY 1 ORDER BY 1`),
      this.pantallas(where, 40),
      this.clics(where, 40),
      this.prisma.$queryRaw<
        { id: string; nombre: string; email: string; empresa: string; vistas: bigint; clics: bigint; sesiones: bigint; dias: bigint; ultima: Date; dispositivo: string | null }[]
      >(Prisma.sql`
        SELECT u.id, u.nombre, u.email, emp.nombre AS empresa,
          count(*) FILTER (WHERE e.tipo = 'vista') AS vistas, count(*) FILTER (WHERE e.tipo = 'clic') AS clics,
          count(DISTINCT e.sesion) AS sesiones,
          count(DISTINCT date_trunc('day', e.creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires')) AS dias,
          max(e.creado_en) AS ultima, mode() WITHIN GROUP (ORDER BY e.dispositivo) AS dispositivo
        ${this.desde} JOIN empresas emp ON emp.id = e.empresa_id
        WHERE ${where} GROUP BY u.id, u.nombre, u.email, emp.nombre ORDER BY ultima DESC LIMIT 300`),
      this.prisma.$queryRaw<{ dispositivo: string | null; usuarios: bigint; eventos: bigint }[]>(Prisma.sql`
        SELECT e.dispositivo, count(DISTINCT e.usuario_id) AS usuarios, count(*) AS eventos
        ${this.desde} WHERE ${where} GROUP BY e.dispositivo ORDER BY eventos DESC`),
    ]);
    const t = tot[0];
    return {
      totales: { usuarios: n(t.usuarios), empresas: n(t.empresas), sesiones: n(t.sesiones), vistas: n(t.vistas), clics: n(t.clics) },
      porDia: dias.map((d) => ({ dia: d.dia.toISOString().slice(0, 10), usuarios: n(d.usuarios), vistas: n(d.vistas), clics: n(d.clics) })),
      pantallas: pantallas.map((p) => ({ ruta: p.ruta, vistas: n(p.vistas), usuarios: n(p.usuarios), empresas: n(p.empresas) })),
      clics: clics.map((c) => ({ objetivo: c.objetivo, ruta: c.ruta, veces: n(c.veces), usuarios: n(c.usuarios) })),
      usuarios: usuarios.map((u) => ({
        id: u.id,
        nombre: u.nombre,
        email: u.email,
        empresa: u.empresa,
        vistas: n(u.vistas),
        clics: n(u.clics),
        sesiones: n(u.sesiones),
        dias: n(u.dias),
        ultima: u.ultima.toISOString(),
        dispositivo: u.dispositivo,
      })),
      dispositivos: dispositivos.map((d) => ({ dispositivo: d.dispositivo ?? 'sin dato', usuarios: n(d.usuarios), eventos: n(d.eventos) })),
    };
  }

  /** Un usuario: sus pantallas, sus botones y lo último que hizo. */
  async usuario(usuarioId: string, q: UsoQuery) {
    const where = this.filtro({ ...q, conAdmins: true }, usuarioId);
    const [usuario, pantallas, clics, recientes] = await Promise.all([
      this.prisma.usuario.findUnique({ where: { id: usuarioId }, select: { id: true, nombre: true, email: true, rolCrudo: true, empresa: { select: { nombre: true } } } }),
      this.pantallas(where, 30),
      this.clics(where, 30),
      this.prisma.$queryRaw<{ tipo: string; ruta: string; objetivo: string | null; dispositivo: string | null; creado_en: Date }[]>(Prisma.sql`
        SELECT e.tipo, e.ruta, e.objetivo, e.dispositivo, e.creado_en ${this.desde} WHERE ${where} ORDER BY e.creado_en DESC, e.id DESC LIMIT 300`),
    ]);
    return {
      usuario: usuario && { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rolCrudo, empresa: usuario.empresa.nombre },
      pantallas: pantallas.map((p) => ({ ruta: p.ruta, vistas: n(p.vistas) })),
      clics: clics.map((c) => ({ objetivo: c.objetivo, ruta: c.ruta, veces: n(c.veces) })),
      recientes: recientes.map((r) => ({ tipo: r.tipo, ruta: r.ruta, objetivo: r.objetivo, dispositivo: r.dispositivo, fecha: r.creado_en.toISOString() })),
    };
  }
}

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AUDITADOS } from '../../common/auditoria/auditoria.util.js';
import { PrismaService } from '../../database/prisma.service.js';
import { rangoDias } from '../inventario/movimientos-generales.util.js';
import type { AuditoriaQuery } from './auditoria.dto.js';

interface FilaBitacora {
  id: bigint;
  empresa_id: string | null;
  empresa: string | null;
  actor_usuario_id: string | null;
  actor_empresa_id: string | null;
  actor_tipo: string;
  actor_nombre: string;
  accion: string;
  entidad: string;
  entidad_id: string | null;
  entidad_nombre: string | null;
  resumen: string;
  cambios: Record<string, [unknown, unknown]> | null;
  ip: string | null;
  creado_en: Date;
}

/**
 * Lectura de la bitácora de auditoría: cada dueño ve la de su empresa y el
 * administrador de la app, la de todas. También verifica la cadena de hashes.
 */
@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  /** empresaId null = todas (consola). */
  async listar(empresaId: string | null, q: AuditoriaQuery) {
    const { inicio, fin } = rangoDias(q.desde, q.hasta);
    const empresa = empresaId ?? q.empresaId ?? null;
    const where = Prisma.sql`r.creado_en >= ${inicio} AND r.creado_en < ${fin}
      ${empresa ? Prisma.sql`AND r.empresa_id = ${empresa}::uuid` : Prisma.empty}
      ${q.actorUsuarioId ? Prisma.sql`AND r.actor_usuario_id = ${q.actorUsuarioId}::uuid` : Prisma.empty}
      ${q.entidad ? Prisma.sql`AND r.entidad = ${q.entidad}` : Prisma.empty}
      ${q.accion ? Prisma.sql`AND r.accion = ${q.accion}` : Prisma.empty}
      ${q.busqueda ? Prisma.sql`AND (r.resumen ILIKE ${`%${q.busqueda}%`} OR r.actor_nombre ILIKE ${`%${q.busqueda}%`})` : Prisma.empty}`;
    const [total, filas] = await Promise.all([
      this.prisma.$queryRaw<{ n: bigint }[]>(Prisma.sql`SELECT count(*) AS n FROM registro_auditoria r WHERE ${where}`),
      this.prisma.$queryRaw<FilaBitacora[]>(Prisma.sql`
        SELECT r.id, r.empresa_id, e.nombre AS empresa, r.actor_usuario_id, r.actor_empresa_id, r.actor_tipo, r.actor_nombre, r.accion,
          r.entidad, r.entidad_id, r.entidad_nombre, r.resumen, r.cambios, r.ip, r.creado_en
        FROM registro_auditoria r LEFT JOIN empresas e ON e.id = r.empresa_id
        WHERE ${where} ORDER BY r.id DESC LIMIT ${q.pageSize} OFFSET ${(q.pagina - 1) * q.pageSize}`),
    ]);
    const consola = empresaId === null;
    return {
      total: Number(total[0].n),
      pagina: q.pagina,
      pageSize: q.pageSize,
      items: filas.map((f) => {
        // Para el cliente, lo que hizo el equipo de Analítica 360 sale con ese nombre (sin emails internos ni IP).
        const delEquipo = !consola && f.actor_tipo === 'admin' && f.actor_empresa_id !== f.empresa_id;
        return {
          id: f.id.toString(),
          fecha: f.creado_en.toISOString(),
          empresa: consola ? f.empresa : undefined,
          actor: delEquipo ? 'Equipo Analítica 360' : f.actor_nombre,
          actorUsuarioId: delEquipo ? null : f.actor_usuario_id,
          actorTipo: f.actor_tipo,
          accion: f.accion,
          entidad: f.entidad,
          entidadNombre: AUDITADOS[f.entidad]?.nombre ?? f.entidad,
          entidadId: f.entidad_id,
          nombre: f.entidad_nombre,
          resumen: f.resumen,
          cambios: f.cambios,
          ip: delEquipo ? null : f.ip,
        };
      }),
    };
  }

  /** Quiénes aparecen en la bitácora (para el filtro). */
  actores(empresaId: string | null) {
    return this.prisma.$queryRaw<{ id: string; nombre: string }[]>(Prisma.sql`
      SELECT DISTINCT ON (r.actor_usuario_id) r.actor_usuario_id AS id, r.actor_nombre AS nombre
      FROM registro_auditoria r
      WHERE r.actor_usuario_id IS NOT NULL ${empresaId ? Prisma.sql`AND r.empresa_id = ${empresaId}::uuid AND r.actor_empresa_id = ${empresaId}::uuid` : Prisma.empty}
      ORDER BY r.actor_usuario_id, r.id DESC`);
  }

  /** Recalcula la cadena de hashes: si alguien tocó o borró una fila, no coincide. */
  async verificar() {
    const [r] = await this.prisma.$queryRaw<{ total: bigint; errores: bigint; primer_error: bigint | null; ultimo_hash: string | null; ultimo_id: bigint | null }[]>(Prisma.sql`
      WITH c AS (
        SELECT r.id, r.hash,
          encode(sha256(convert_to(coalesce(lag(r.hash) OVER (ORDER BY r.id), 'genesis') || '|' || registro_auditoria_contenido(r), 'UTF8')), 'hex') AS esperado
        FROM registro_auditoria r
      )
      SELECT count(*) AS total, count(*) FILTER (WHERE hash <> esperado) AS errores, min(id) FILTER (WHERE hash <> esperado) AS primer_error,
        (SELECT hash FROM registro_auditoria ORDER BY id DESC LIMIT 1) AS ultimo_hash, max(id) AS ultimo_id
      FROM c`);
    return {
      total: Number(r.total),
      integra: Number(r.errores) === 0,
      errores: Number(r.errores),
      primerError: r.primer_error?.toString() ?? null,
      ultimoId: r.ultimo_id?.toString() ?? null,
      ultimoHash: r.ultimo_hash,
      verificadoEn: new Date().toISOString(),
    };
  }
}

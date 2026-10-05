import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import type { Env } from '../../config/env.validation.js';
import { PrismaService } from '../../database/prisma.service.js';
import {
  codigoReferido,
  DESCUENTO_NUEVO_PCT,
  DIAS_PRUEBA_REFERIDO,
  MAX_PREMIOS_POR_ANIO,
  PREMIO_PCT,
  porcentajePremios,
  reglasReferido,
} from './referidos.util.js';

const fecha = (d: Date | null | undefined) => d?.toISOString().slice(0, 10) ?? null;

/** "Recomendá y ganá": el código de cada cliente, a quiénes recomendó y lo que ganó. */
@Injectable()
export class ReferidosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** El código de referido de la empresa (se crea la primera vez). */
  async codigoDe(empresaId: string): Promise<{ id: string; codigo: string }> {
    const existente = await this.prisma.cupon.findFirst({ where: { tipo: 'referido', empresaReferenteId: empresaId }, select: { id: true, codigo: true } });
    if (existente) return existente;
    const empresa = await this.prisma.empresa.findUniqueOrThrow({ where: { id: empresaId }, select: { nombre: true } });
    // Otro igual es improbable (31³ por nombre); si pasa, se prueba con otro.
    for (let intento = 0; intento < 5; intento++) {
      try {
        return await this.prisma.cupon.create({
          data: {
            codigo: codigoReferido(empresa.nombre),
            tipo: 'referido',
            empresaReferenteId: empresaId,
            descripcion: `Recomendado por ${empresa.nombre}`,
            diasPrueba: DIAS_PRUEBA_REFERIDO,
            reglas: reglasReferido() as unknown as Prisma.InputJsonValue,
          },
          select: { id: true, codigo: true },
        });
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
        // Dos pedidos a la vez: si ya se creó, se usa ese.
        const ya = await this.prisma.cupon.findFirst({ where: { tipo: 'referido', empresaReferenteId: empresaId }, select: { id: true, codigo: true } });
        if (ya) return ya;
      }
    }
    throw new Error('No se pudo generar el código de referido');
  }

  /** Consola: lo mismo que ve el cliente (sin crearle el código si no lo tiene) y quién lo recomendó a él. */
  async resumenAdmin(empresaId: string) {
    const [propio, empresa] = await Promise.all([
      this.prisma.cupon.findFirst({ where: { tipo: 'referido', empresaReferenteId: empresaId }, select: { id: true, codigo: true } }),
      this.prisma.empresa.findUnique({
        where: { id: empresaId },
        select: { cupon: { select: { tipo: true, codigo: true, empresaReferente: { select: { id: true, nombre: true } } } }, premioComoReferida: { select: { estado: true } } },
      }),
    ]);
    const recomendadoPor =
      empresa?.cupon?.tipo === 'referido' && empresa.cupon.empresaReferente
        ? { empresaId: empresa.cupon.empresaReferente.id, nombre: empresa.cupon.empresaReferente.nombre, codigo: empresa.cupon.codigo, premio: empresa.premioComoReferida?.estado ?? null }
        : null;
    if (!propio) return { codigo: null, recomendadoPor, premios: null, recomendados: [] };
    const r = await this.resumen(empresaId);
    return { codigo: r.codigo, recomendadoPor, premios: r.premios, recomendados: r.recomendados };
  }

  async resumen(empresaId: string) {
    const { id, codigo } = await this.codigoDe(empresaId);
    const [recomendados, premios] = await Promise.all([
      this.prisma.empresa.findMany({
        where: { cuponId: id, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: { id: true, nombre: true, createdAt: true, primerPagoEn: true, premioComoReferida: { select: { estado: true } } },
      }),
      this.prisma.premioReferido.findMany({ where: { empresaReferenteId: empresaId }, select: { estado: true, porcentaje: true, creadoEn: true } }),
    ]);
    const disponibles = premios.filter((p) => p.estado === 'disponible');
    const haceUnAnio = Date.now() - 365 * 86_400_000;
    const web = this.config.get('CORS_ORIGINS', { infer: true }).split(',')[0].trim().replace(/\/$/, '');
    return {
      codigo,
      link: `${web}/sign-up?codigo=${encodeURIComponent(codigo)}`,
      reglas: { diasPrueba: DIAS_PRUEBA_REFERIDO, descuentoNuevoPct: DESCUENTO_NUEVO_PCT, premioPct: PREMIO_PCT, maxPorAnio: MAX_PREMIOS_POR_ANIO },
      premios: {
        disponibles: disponibles.length,
        /** % que se descuenta en su próximo pago. */
        pctProximoPago: porcentajePremios(disponibles.map((p) => Number(p.porcentaje))),
        usados: premios.filter((p) => p.estado === 'usado').length,
        delAnio: premios.filter((p) => ['disponible', 'usado'].includes(p.estado) && p.creadoEn.getTime() >= haceUnAnio).length,
        fueraDeTope: premios.filter((p) => p.estado === 'tope').length,
      },
      // Solo el nombre del negocio y cómo va: nada de sus datos.
      recomendados: recomendados.map((r) => ({
        nombre: r.nombre,
        desde: fecha(r.createdAt),
        estado: r.premioComoReferida ? (r.premioComoReferida.estado === 'anulado' ? 'devuelto' : 'pago') : r.primerPagoEn ? 'pago' : 'en_prueba',
        premio: r.premioComoReferida?.estado ?? null,
      })),
    };
  }
}

import { Injectable, Logger, ServiceUnavailableException, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CacheLecturasService } from '../../common/cache/cache-lecturas.js';
import { PrismaService } from '../../database/prisma.service.js';
import { fechaHoyAR, sumarDiasIso } from '../analytics/analytics.util.js';
import { CASAS_DOLAR, conversorDesde, EN_PESOS, type CasaDolar, type Conversor } from './conversor.js';

/** Fuente pública y gratuita, con historia diaria (blue y oficial desde 2011, MEP desde 2018). */
const FUENTE = 'https://api.argentinadatos.com/v1/cotizaciones/dolares';
const CADA_MS = 3 * 3600_000;

export type Moneda = 'ARS' | 'USD';

@Injectable()
export class CotizacionesService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('Cotizaciones');
  private timers: NodeJS.Timeout[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheLecturasService,
  ) {}

  onApplicationBootstrap() {
    if (process.env.VITEST) return;
    this.timers = [setTimeout(() => void this.sincronizar(), 5_000), setInterval(() => void this.sincronizar(), CADA_MS)];
    for (const t of this.timers) t.unref();
  }

  onApplicationShutdown() {
    for (const t of this.timers) clearTimeout(t);
  }

  /** Trae la historia de las tres cotizaciones y guarda lo nuevo (o lo corregido). */
  async sincronizar(): Promise<number> {
    let total = 0;
    for (const casa of CASAS_DOLAR) {
      try {
        const r = await fetch(`${FUENTE}/${casa}`, { headers: { 'User-Agent': 'Analitica360/1.0 (+https://analitica360.app)' }, signal: AbortSignal.timeout(30_000) });
        if (!r.ok) throw new Error(`respondió ${r.status}`);
        const filas = ((await r.json()) as { fecha?: string; compra?: number; venta?: number }[]).filter(
          (f) => typeof f.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f.fecha) && Number(f.venta) > 0,
        );
        // Solo lo de los últimos 10 días se puede corregir; la primera vez entra todo.
        const ultima = await this.prisma.cotizacionDolar.findFirst({ where: { casa }, orderBy: { fecha: 'desc' }, select: { fecha: true } });
        const desde = ultima ? sumarDiasIso(ultima.fecha.toISOString().slice(0, 10), -10) : '0000-00-00';
        const nuevas = filas.filter((f) => f.fecha! >= desde);
        for (let i = 0; i < nuevas.length; i += 1000) {
          const lote = nuevas.slice(i, i + 1000);
          await this.prisma.$executeRaw(Prisma.sql`
            INSERT INTO cotizaciones_dolar (casa, fecha, compra, venta)
            SELECT ${casa}, x.fecha::date, x.compra::numeric, x.venta::numeric
            FROM unnest(${lote.map((f) => f.fecha)}::text[], ${lote.map((f) => Number(f.compra) || Number(f.venta))}::float8[], ${lote.map((f) => Number(f.venta))}::float8[]) AS x(fecha, compra, venta)
            ON CONFLICT (casa, fecha) DO UPDATE SET compra = EXCLUDED.compra, venta = EXCLUDED.venta
          `);
        }
        total += nuevas.length;
      } catch (e) {
        this.logger.warn(`No se pudo actualizar el dólar ${casa}: ${(e as Error).message}`);
      }
    }
    // Los reportes en dólares guardados pueden haber cambiado.
    if (total) this.cache.invalidar(null);
    return total;
  }

  /** El dólar que eligió la empresa (Configuración fiscal). */
  async casaDe(empresaId: string): Promise<CasaDolar> {
    const c = await this.prisma.configuracionEmpresa.findUnique({ where: { empresaId }, select: { dolarTipo: true } });
    return CASAS_DOLAR.includes(c?.dolarTipo as CasaDolar) ? (c!.dolarTipo as CasaDolar) : 'blue';
  }

  /** Conversor para un rango de días: en pesos no consulta nada. */
  async conversor(empresaId: string, moneda: Moneda | undefined, desde: string, hasta: string = fechaHoyAR()): Promise<Conversor> {
    if (moneda !== 'USD') return EN_PESOS;
    const casa = await this.casaDe(empresaId);
    const hoy = fechaHoyAR();
    const tope = hasta > hoy ? hasta : hoy;
    // La última cotización anterior al rango (fines de semana) + todo el rango + hoy.
    const filas = await this.prisma.$queryRaw<{ fecha: string; venta: string }[]>(Prisma.sql`
      SELECT fecha::text, venta FROM cotizaciones_dolar
      WHERE casa = ${casa} AND fecha >= COALESCE((SELECT MAX(fecha) FROM cotizaciones_dolar WHERE casa = ${casa} AND fecha <= ${desde}::date), ${desde}::date)
        AND fecha <= ${tope}::date
      ORDER BY fecha
    `);
    if (!filas.length) throw new ServiceUnavailableException('Todavía no tenemos la cotización del dólar. Probá de nuevo en unos minutos.');
    return conversorDesde(casa, filas.map((f) => ({ fecha: f.fecha, venta: Number(f.venta) })), hoy, desde, hasta);
  }

  /** Para el botón $ / US$: qué dólar y cuánto vale hoy. */
  async hoy(empresaId: string): Promise<{ casa: CasaDolar; venta: number | null; fecha: string | null }> {
    const casa = await this.casaDe(empresaId);
    const f = await this.prisma.cotizacionDolar.findFirst({ where: { casa }, orderBy: { fecha: 'desc' } });
    return { casa, venta: f ? f.venta.toNumber() : null, fecha: f ? f.fecha.toISOString().slice(0, 10) : null };
  }
}

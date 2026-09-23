import { Injectable, Logger } from '@nestjs/common';
import { mesKeyDe } from './inflacion.util.js';

const BCRA_DATOS = 'https://api.bcra.gob.ar/estadisticas/v2.0/datosvariable/27';

function sumarDiasCapped(iso: string, dias: number, cap: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + dias);
  const next = dt.toISOString().slice(0, 10);
  return next > cap ? cap : next;
}

/** Puerto de trozosAnio (src/lib/inflacion.ts): la API del BCRA limita el rango por request. */
function trozosAnio(desde: string, hasta: string): { desde: string; hasta: string }[] {
  const out: { desde: string; hasta: string }[] = [];
  let cur = desde;
  while (cur <= hasta) {
    const tope = sumarDiasCapped(cur, 364, hasta);
    out.push({ desde: cur, hasta: tope });
    if (tope >= hasta) break;
    cur = sumarDiasCapped(tope, 1, hasta);
  }
  return out;
}

function filasBcra(json: unknown): { fecha?: string; valor?: number }[] {
  if (!json || typeof json !== 'object') return [];
  const obj = json as { results?: unknown };
  return Array.isArray(obj.results) ? (obj.results as { fecha?: string; valor?: number }[]) : [];
}

/**
 * Puerto de inflacionDesdeBcra/fetchBcraTramo (src/lib/inflacion.ts): serie
 * "Inflación mensual (INDEC)" (variable 27) de la API pública del BCRA -
 * usada solo para completar meses que no están en la tabla estática
 * INFLACION_INDEC. Solo lectura, API pública sin autenticación.
 */
@Injectable()
export class BcraInflacionClient {
  private readonly logger = new Logger(BcraInflacionClient.name);
  private readonly cache = new Map<string, Promise<Record<string, number> | null>>();

  async inflacionDesdeBcra(desde: string, hasta: string): Promise<Record<string, number> | null> {
    const key = `${desde}|${hasta}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const pending = this.cargar(desde, hasta);
    this.cache.set(key, pending);
    return pending;
  }

  private async cargar(desde: string, hasta: string): Promise<Record<string, number> | null> {
    const merged: Record<string, number> = {};
    for (const tramo of trozosAnio(desde, hasta)) {
      const chunk = await this.fetchTramo(tramo.desde, tramo.hasta);
      if (chunk == null) return null;
      Object.assign(merged, chunk);
    }
    return merged;
  }

  private async fetchTramo(desde: string, hasta: string): Promise<Record<string, number> | null> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(`${BCRA_DATOS}/${desde}/${hasta}`, { signal: ctrl.signal });
      if (!res.ok) return null;
      const json: unknown = await res.json();
      const out: Record<string, number> = {};
      for (const row of filasBcra(json)) {
        const key = mesKeyDe(String(row.fecha ?? ''));
        const valor = Number(row.valor);
        if (key.length === 7 && Number.isFinite(valor)) out[key] = valor;
      }
      return out;
    } catch (e) {
      this.logger.warn(`No se pudo obtener inflación del BCRA (${desde}/${hasta}): ${e instanceof Error ? e.message : e}`);
      return null;
    } finally {
      clearTimeout(t);
    }
  }
}

import { type CanActivate, type ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';

/** Pedidos por minuto y por cliente (IP real; detrás de la tienda, la IP del comprador). LIMITE_PEDIDOS_POR_MINUTO=0 lo apaga. */
const GENERAL = Number(process.env.LIMITE_PEDIDOS_POR_MINUTO ?? 600);
/** Rutas que se llaman solas (ej. métricas de uso): más ajustado. */
const POR_RUTA: Record<string, number> = { 'POST /uso/eventos': 60 };
const VENTANA_MS = 60_000;

/**
 * Límite general de pedidos para toda la API (ASVS V11: anti-abuso). Contador en
 * memoria por ventana de un minuto: alcanza con un servidor; con varios, cada uno
 * cuenta lo suyo (el límite queda más laxo, no más estricto).
 *
 * Detrás de un proxy (Caddy) la IP real llega en x-forwarded-for: Express la usa como
 * req.ip si se configura TRUST_PROXY (ver main.ts). Las tiendas llaman desde su
 * servidor: con la clave TIENDA_PROXY_KEY se cuenta la IP del comprador que reenvían.
 */
@Injectable()
export class LimitePedidosGuard implements CanActivate {
  private readonly cuentas = new Map<string, { inicio: number; n: number }>();
  private ultimaLimpieza = Date.now();

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http' || process.env.VITEST || GENERAL <= 0) return true;
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const ruta = `${req.method} ${(req.route as { path?: string } | undefined)?.path ?? req.path}`;
    const limite = POR_RUTA[ruta] ?? GENERAL;
    const clave = `${quien(req)}|${POR_RUTA[ruta] ? ruta : '*'}`;
    const ahora = Date.now();
    this.limpiar(ahora);

    let c = this.cuentas.get(clave);
    if (!c || ahora - c.inicio >= VENTANA_MS) {
      c = { inicio: ahora, n: 0 };
      this.cuentas.set(clave, c);
    }
    c.n++;
    if (c.n > limite) {
      res.setHeader('Retry-After', String(Math.ceil((c.inicio + VENTANA_MS - ahora) / 1000)));
      throw new HttpException('Demasiados pedidos seguidos. Esperá un minuto y probá de nuevo.', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }

  /** Cada tanto se tiran los contadores viejos (que no crezca la memoria). */
  private limpiar(ahora: number) {
    if (ahora - this.ultimaLimpieza < VENTANA_MS) return;
    this.ultimaLimpieza = ahora;
    for (const [k, v] of this.cuentas) if (ahora - v.inicio >= VENTANA_MS) this.cuentas.delete(k);
  }
}

function quien(req: Request): string {
  const clave = process.env.TIENDA_PROXY_KEY;
  const reenviada = req.headers['x-forwarded-for'];
  if (clave && req.headers['x-tienda-key'] === clave && typeof reenviada === 'string' && reenviada.trim()) {
    return `cliente:${reenviada.split(',')[0].trim()}`;
  }
  return req.ip ?? 'desconocido';
}

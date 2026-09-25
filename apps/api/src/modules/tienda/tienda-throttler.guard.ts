import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

/**
 * Límite de requests por cliente de la tienda. Las tiendas llaman a esta API
 * desde su servidor, así que req.ip sería el mismo para todos sus clientes:
 * si la tienda se identifica con TIENDA_PROXY_KEY (header x-tienda-key), se
 * usa la IP real del cliente que reenvía en x-forwarded-for. Sin la clave,
 * el header se ignora (cualquiera podría falsificarlo).
 */
@Injectable()
export class TiendaThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const request = req as unknown as Request;
    const clave = process.env.TIENDA_PROXY_KEY;
    const reenviada = request.headers['x-forwarded-for'];
    if (clave && request.headers['x-tienda-key'] === clave && typeof reenviada === 'string' && reenviada.trim()) {
      return `cliente:${reenviada.split(',')[0].trim()}`;
    }
    return request.ip ?? 'desconocido';
  }
}

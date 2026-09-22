import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { Env } from '../../config/env.validation.js';

/**
 * Protege POST /internal/clerk-webhook: no es un endpoint público de Clerk
 * (esa verificación con svix ya la hizo apps/web), es un reenvío interno
 * servidor-a-servidor. Exige el header X-Internal-Webhook-Secret con el
 * mismo valor que INTERNAL_WEBHOOK_SECRET en ambos .env.
 */
@Injectable()
export class InternalWebhookGuard implements CanActivate {
  constructor(private readonly config: ConfigService<Env, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const secret = request.headers['x-internal-webhook-secret'];
    const esperado = this.config.get('INTERNAL_WEBHOOK_SECRET', { infer: true });
    if (secret !== esperado) {
      throw new UnauthorizedException('Secreto de reenvío interno inválido');
    }
    return true;
  }
}

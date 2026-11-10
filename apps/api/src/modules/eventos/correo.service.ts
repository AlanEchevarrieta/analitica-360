import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.validation.js';
import { esErrorTemporal } from './eventos.util.js';

export interface AdjuntoCorreo {
  filename: string;
  /** Contenido en base64. */
  content: string;
}

export interface EnviarCorreoInput {
  para: string | string[];
  asunto: string;
  texto?: string;
  html?: string;
  desde?: string;
  responderA?: string;
  adjuntos?: AdjuntoCorreo[];
  headers?: Record<string, string>;
}

export type ResultadoCorreo =
  | { ok: true; id: string }
  | { ok: false; temporal: boolean; sinClave?: boolean; error: string };

/**
 * Único servicio que habla con Resend (`https://api.resend.com/emails`).
 * Clasifica si un fallo es temporal (sin clave, red, 429, cuota diaria, 5xx)
 * o definitivo (4xx de validación), para que la cola de eventos sepa si reintentar.
 */
@Injectable()
export class CorreoService {
  private readonly logger = new Logger('Correo');

  constructor(private readonly config: ConfigService<Env, true>) {}

  tieneClave(): boolean {
    return Boolean(this.config.get('RESEND_API_KEY', { infer: true }));
  }

  remitentePorDefecto(): string {
    return this.config.get('AVISOS_EMAIL_DESDE', { infer: true });
  }

  async enviar(input: EnviarCorreoInput): Promise<ResultadoCorreo> {
    const clave = this.config.get('RESEND_API_KEY', { infer: true });
    if (!clave) {
      return {
        ok: false,
        temporal: true,
        sinClave: true,
        error: 'Falta RESEND_API_KEY: queda pendiente para reintentar cuando se configure',
      };
    }

    const destinatarios = (Array.isArray(input.para) ? input.para : [input.para])
      .map((d) => d.trim())
      .filter(Boolean);

    if (destinatarios.length === 0 || destinatarios.some((d) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d))) {
      return {
        ok: false,
        temporal: false,
        error: 'El email no es válido',
      };
    }

    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${clave}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: input.desde ?? this.remitentePorDefecto(),
          to: destinatarios,
          subject: input.asunto,
          ...(input.html ? { html: input.html } : {}),
          ...(input.texto ? { text: input.texto } : {}),
          ...(input.responderA ? { reply_to: input.responderA } : {}),
          ...(input.adjuntos?.length ? { attachments: input.adjuntos } : {}),
          ...(input.headers ? { headers: input.headers } : {}),
        }),
        signal: AbortSignal.timeout(25_000),
      });

      const body = (await r.json().catch(() => null)) as { id?: string; message?: string; name?: string } | null;

      if (!r.ok) {
        const msg = body?.message ?? `Resend respondió ${r.status}`;
        const temporal = esErrorTemporal({ status: r.status, codigo: body?.name ?? null, mensaje: msg });
        this.logger.warn(`Fallo al enviar correo a ${destinatarios.join(', ')} (${r.status}): ${msg}`);
        return { ok: false, temporal, error: `${r.status}: ${msg}` };
      }

      return { ok: true, id: body?.id ?? 'enviado' };
    } catch (e) {
      const msg = (e as Error)?.message ?? String(e);
      this.logger.warn(`Error de red al enviar correo a ${destinatarios.join(', ')}: ${msg}`);
      return {
        ok: false,
        temporal: esErrorTemporal({ status: null, mensaje: msg }),
        error: msg,
      };
    }
  }
}

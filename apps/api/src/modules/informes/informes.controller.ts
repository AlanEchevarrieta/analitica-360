import { Body, Controller, Get, Header, Param, ParseEnumPipe, Patch, Post, Query, StreamableFile } from '@nestjs/common';
import { z } from 'zod';
import type { EmpresaContext, UsuarioContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { InformesService } from './informes.service.js';
import { TIPOS_INFORME, type TipoInforme } from './informes.util.js';

const configSchema = z.object({
  semanal: z.boolean().optional(),
  mensual: z.boolean().optional(),
  conDolares: z.boolean().optional(),
  emailsExtra: z.array(z.string().trim().email('Hay un email que no es válido').max(160)).max(5, 'Hasta 5 emails extra').optional(),
  /** Volver a mandarle a un email que se había dado de baja. */
  reactivar: z.string().trim().email().optional(),
});
type ConfigInput = z.infer<typeof configSchema>;

const Tipo = new ParseEnumPipe(Object.fromEntries(TIPOS_INFORME.map((t) => [t, t])));

/** Informes semanales y mensuales por email (Configuración → Informes): solo el dueño. */
@Controller('informes')
export class InformesController {
  constructor(private readonly informes: InformesService) {}

  @Get('config')
  @Roles('dueno')
  verConfig(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.informes.verConfig(empresa.id);
  }

  @Patch('config')
  @Roles('dueno')
  guardarConfig(@CurrentEmpresa() empresa: EmpresaContext, @Body(new ZodValidationPipe(configSchema)) body: ConfigInput) {
    return this.informes.guardarConfig(empresa.id, body);
  }

  @Get('historial')
  @Roles('dueno')
  historial(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.informes.historial(empresa.id);
  }

  /** El PDF del último período cerrado: el mismo que llega por email. */
  @Get('pdf/:tipo')
  @Roles('dueno')
  async pdf(@CurrentEmpresa() empresa: EmpresaContext, @Param('tipo', Tipo) tipo: TipoInforme) {
    const { archivo, contenido } = await this.informes.pdf(empresa.id, tipo);
    return new StreamableFile(contenido, { type: 'application/pdf', disposition: `attachment; filename="${archivo}"` });
  }

  @Post('prueba/:tipo')
  @Roles('dueno')
  prueba(@CurrentEmpresa() empresa: EmpresaContext, @CurrentUser() usuario: UsuarioContext, @Param('tipo', Tipo) tipo: TipoInforme) {
    return this.informes.enviarPrueba(empresa.id, tipo, usuario.email);
  }

  /** Link "No quiero recibir más" del email: sin sesión, con un token firmado. */
  @Get('baja')
  @Public()
  @Header('Content-Type', 'text/html; charset=utf-8')
  async baja(@Query('t') t = '') {
    const r = await this.informes.baja(String(t).slice(0, 1000));
    const mensaje = r.ok
      ? `Listo: no vas a recibir más el informe ${r.tipo} de ${escapar(r.empresa ?? '')}. Si te arrepentís, el dueño de la cuenta lo vuelve a activar en Configuración → Informes.`
      : 'El link no es válido o está incompleto. Podés configurar los informes desde la app, en Configuración → Informes.';
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Informes · Analítica 360</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#f3f4f6;margin:0;padding:40px 16px"><div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:28px">
<div style="font-size:11px;color:#4f46e5;letter-spacing:1.5px;font-weight:bold">ANALÍTICA 360</div><p style="font-size:16px;color:#111827;line-height:1.5">${mensaje}</p></div></body></html>`;
  }
}

const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

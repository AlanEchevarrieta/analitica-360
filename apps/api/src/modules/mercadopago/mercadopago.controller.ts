import { Body, Controller, Get, Headers, HttpCode, Logger, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import type { EmpresaContext, UsuarioContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { PermitidoSinSuscripcion } from '../../common/decorators/suscripcion.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { Env } from '../../config/env.validation.js';
import { MercadoPagoService } from './mercadopago.service.js';
import { firmaValida } from './mercadopago.util.js';

const activarSchema = z.object({ plan: z.enum(['basico', 'pro', 'ecommerce']), ciclo: z.enum(['mensual', 'trimestral', 'anual']) });
type ActivarDto = z.infer<typeof activarSchema>;

/** Débito automático del plan (lo ve y usa también una cuenta vencida: es como se pone al día). */
@PermitidoSinSuscripcion()
@Controller('suscripcion/mercadopago')
export class MercadoPagoController {
  constructor(private readonly servicio: MercadoPagoService) {}

  @Get()
  estado(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.servicio.estado(empresa.id);
  }

  @Post()
  activar(@CurrentEmpresa() empresa: EmpresaContext, @CurrentUser() usuario: UsuarioContext, @Body(new ZodValidationPipe(activarSchema)) body: ActivarDto) {
    return this.servicio.activar(empresa.id, usuario, body.plan, body.ciclo);
  }

  @Post('cancelar')
  @HttpCode(204)
  async cancelar(@CurrentEmpresa() empresa: EmpresaContext, @CurrentUser() usuario: UsuarioContext) {
    await this.servicio.cancelar(empresa.id, usuario);
  }
}

/** Avisos de Mercado Pago (sin sesión): se aceptan solo con la firma de la aplicación. */
@Public()
@Controller('webhooks/mercadopago')
export class MercadoPagoWebhookController {
  private readonly logger = new Logger('MercadoPago');

  constructor(
    private readonly servicio: MercadoPagoService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Post()
  @HttpCode(200)
  async aviso(
    @Headers('x-signature') firma: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
    @Query('data.id') dataIdQuery: string | undefined,
    @Body() cuerpo: { type?: string; action?: string; data?: { id?: string | number } },
  ) {
    const secreto = this.config.get('MP_WEBHOOK_SECRET', { infer: true });
    const dataId = dataIdQuery ?? (cuerpo?.data?.id != null ? String(cuerpo.data.id) : undefined);
    if (!secreto || !firmaValida({ firma, requestId, dataId, secreto })) throw new UnauthorizedException('Firma inválida');
    if (!cuerpo?.type || !dataId) return { ok: true };
    const resultado = await this.servicio.procesarAviso(cuerpo.type, dataId);
    this.logger.log(`Aviso de Mercado Pago: ${resultado}`);
    return { ok: true };
  }
}

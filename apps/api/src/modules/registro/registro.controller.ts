import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import type { EmpresaContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { SinEmpresa } from '../../common/decorators/sin-empresa.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { RegistroService } from './registro.service.js';

const registroSchema = z.object({
  nombreNegocio: z.string().trim().min(2, 'Poné el nombre de tu negocio').max(80),
  rubro: z.string().trim().min(1, 'Elegí el rubro').max(60),
  telefono: z.string().trim().min(6, 'Dejanos un WhatsApp para ayudarte').max(30),
  origen: z.string().trim().max(80).nullable().default(null),
  aceptaTerminos: z.literal(true, { message: 'Tenés que aceptar los términos y condiciones' }),
});
type RegistroBody = z.infer<typeof registroSchema>;

@Controller('registro')
export class RegistroController {
  constructor(private readonly service: RegistroService) {}

  /** Alta de empresa nueva con prueba gratis (usuario logueado sin empresa). */
  @Post()
  @HttpCode(201)
  @SinEmpresa()
  registrar(@Req() request: Request, @Body(new ZodValidationPipe(registroSchema)) body: RegistroBody) {
    return this.service.registrar(
      request.clerkAuth!.clerkUserId,
      { nombreNegocio: body.nombreNegocio, rubro: body.rubro, telefono: body.telefono, origen: body.origen || null },
      request.headers['user-agent'] ?? null,
    );
  }

  @Get('primeros-pasos')
  primerosPasos(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.service.primerosPasos(empresa.id);
  }
}

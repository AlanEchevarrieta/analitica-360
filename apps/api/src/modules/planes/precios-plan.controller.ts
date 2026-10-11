import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { z } from 'zod';
import type { UsuarioContext } from '../../common/auth/request-context.types.js';
import { RequireAdminApp } from '../../common/decorators/admin-app.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { PreciosPlanService, type ProgramarAumentoInput } from './precios-plan.service.js';

const precio = z.number().int().min(1000).max(10_000_000);
const programarSchema = z.object({
  vigenteDesde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (AAAA-MM-DD)'),
  porcentaje: z.number().min(0.1).max(100).optional(),
  precios: z.object({ basico: precio.optional(), pro: precio.optional(), ecommerce: precio.optional() }).optional(),
  motivo: z.string().max(200).optional(),
});

/** Precios de lista de hoy (y el próximo aumento ya avisado), para la landing. Sin sesión. */
@Controller('planes')
export class PreciosPublicosController {
  constructor(private readonly precios: PreciosPlanService) {}

  @Get('precios')
  @Public()
  publicos() {
    return this.precios.publicos();
  }
}

/** Consola: aumentos de precio programados (IPC) con aviso de 30 días. */
@Controller('admin/precios')
@RequireAdminApp()
export class AdminPreciosController {
  constructor(private readonly precios: PreciosPlanService) {}

  @Get()
  panel() {
    return this.precios.panel();
  }

  @Post()
  programar(@Body(new ZodValidationPipe(programarSchema)) body: ProgramarAumentoInput, @CurrentUser() usuario: UsuarioContext) {
    return this.precios.programar(body, usuario.email ?? null);
  }

  @Delete(':id')
  cancelar(@Param('id', ParseUUIDPipe) id: string) {
    return this.precios.cancelar(id);
  }

  /** Reintenta ya el aviso pendiente (por ejemplo, después de configurar el email). */
  @Post('avisar')
  async avisar() {
    return { enviados: await this.precios.avisarPendientes() };
  }
}

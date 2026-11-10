import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { RequireAdminApp } from '../../common/decorators/admin-app.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { EventosService } from './eventos.service.js';
import type { EstadoEvento } from './eventos.util.js';

const listarQuerySchema = z.object({
  estado: z.enum(['pendiente', 'procesando', 'hecho', 'fallo', 'descartado']).optional(),
  tipo: z.string().trim().max(60).optional(),
  empresaId: z.string().uuid().optional(),
});

@Controller('admin/eventos')
@RequireAdminApp()
export class EventosAdminController {
  constructor(private readonly eventos: EventosService) {}

  @Get()
  listar(@Query(new ZodValidationPipe(listarQuerySchema)) q: z.infer<typeof listarQuerySchema>) {
    return this.eventos.listarAdmin({
      estado: q.estado as EstadoEvento | undefined,
      tipo: q.tipo || undefined,
      empresaId: q.empresaId,
    });
  }

  @Get('resumen')
  resumen() {
    return this.eventos.resumenAdmin();
  }

  @Post(':id/reintentar')
  @HttpCode(200)
  reintentar(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.eventos.reintentarAdmin(id);
  }

  @Post(':id/descartar')
  @HttpCode(200)
  descartar(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.eventos.descartarAdmin(id);
  }
}

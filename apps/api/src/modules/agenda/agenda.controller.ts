import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import type { EmpresaContext, UsuarioContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireFuncion } from '../../common/decorators/funcion.decorator.js';
import { RequirePermiso } from '../../common/decorators/permiso.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { AgendaService, type RecursoInput, type TurnoInput } from './agenda.service.js';
import { ESTADOS_TURNO } from './agenda.util.js';

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (AAAA-MM-DD)');
const fechaHora = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Formato de fecha y hora inválido');
const texto = (max: number) => z.string().trim().max(max).nullable().optional();
const recursoSchema = z.object({
  nombre: z.string().trim().min(1, 'Poné un nombre').max(80),
  usuarioId: z.uuid().nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  online: z.boolean().optional(),
  activo: z.boolean().optional(),
  horarios: z.array(z.object({ diaSemana: z.number().int().min(0).max(6), desde: z.string(), hasta: z.string() })).max(50).default([]),
});
const turnoSchema = z.object({
  recursoId: z.uuid(),
  servicioId: z.uuid().nullable().optional(),
  clienteId: z.uuid().nullable().optional(),
  clienteNombre: texto(160),
  clienteTelefono: texto(40),
  inicio: fechaHora,
  duracionMin: z.number().int().min(5).max(1440).nullable().optional(),
  notas: texto(1000),
  forzar: z.boolean().optional(),
});
const rangoSchema = z.object({ desde: fecha, hasta: fecha, recursoId: z.uuid().optional() });
const libresSchema = z.object({ recursoId: z.uuid(), fecha, duracionMin: z.coerce.number().int().min(5).max(1440).optional(), servicioId: z.uuid().optional() });

/** Agenda y turnos (plan Pro). Profesionales, horarios y días cerrados: el dueño; turnos: quien vende. */
@Controller('agenda')
@RequireFuncion('agenda')
export class AgendaController {
  constructor(private readonly agenda: AgendaService) {}

  @Get('recursos')
  recursos(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.agenda.recursos(empresa.id);
  }

  @Post('recursos')
  @Roles('dueno')
  crearRecurso(@CurrentEmpresa() empresa: EmpresaContext, @Body(new ZodValidationPipe(recursoSchema)) body: RecursoInput) {
    return this.agenda.crearRecurso(empresa.id, body);
  }

  @Put('recursos/:id')
  @Roles('dueno')
  editarRecurso(@CurrentEmpresa() empresa: EmpresaContext, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(recursoSchema)) body: RecursoInput) {
    return this.agenda.editarRecurso(empresa.id, id, body);
  }

  @Delete('recursos/:id')
  @Roles('dueno')
  borrarRecurso(@CurrentEmpresa() empresa: EmpresaContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.agenda.borrarRecurso(empresa.id, id);
  }

  @Get('bloqueos')
  bloqueos(@CurrentEmpresa() empresa: EmpresaContext, @Query(new ZodValidationPipe(rangoSchema)) q: z.infer<typeof rangoSchema>) {
    return this.agenda.bloqueos(empresa.id, q.desde, q.hasta);
  }

  @Post('bloqueos')
  @Roles('dueno')
  crearBloqueo(@CurrentEmpresa() empresa: EmpresaContext, @Body(new ZodValidationPipe(z.object({ fecha, recursoId: z.uuid().nullable().optional(), motivo: texto(120) }))) body: { fecha: string; recursoId?: string | null; motivo?: string | null }) {
    return this.agenda.crearBloqueo(empresa.id, body);
  }

  @Delete('bloqueos/:id')
  @Roles('dueno')
  borrarBloqueo(@CurrentEmpresa() empresa: EmpresaContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.agenda.borrarBloqueo(empresa.id, id);
  }

  @Get('turnos')
  turnos(@CurrentEmpresa() empresa: EmpresaContext, @Query(new ZodValidationPipe(rangoSchema)) q: z.infer<typeof rangoSchema>) {
    return this.agenda.turnos(empresa.id, q.desde, q.hasta, q.recursoId);
  }

  @Get('libres')
  libres(@CurrentEmpresa() empresa: EmpresaContext, @Query(new ZodValidationPipe(libresSchema)) q: z.infer<typeof libresSchema>) {
    return this.agenda.libres(empresa.id, q.recursoId, q.fecha, q.duracionMin, q.servicioId);
  }

  @Post('turnos')
  @RequirePermiso('registrar_ventas')
  crearTurno(@CurrentEmpresa() empresa: EmpresaContext, @CurrentUser() usuario: UsuarioContext, @Body(new ZodValidationPipe(turnoSchema)) body: TurnoInput) {
    return this.agenda.crearTurno(empresa.id, usuario.id, { ...body, origen: 'interno' });
  }

  @Patch('turnos/:id')
  @RequirePermiso('registrar_ventas')
  reprogramar(@CurrentEmpresa() empresa: EmpresaContext, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(turnoSchema.partial())) body: Partial<TurnoInput>) {
    return this.agenda.reprogramar(empresa.id, id, body);
  }

  @Post('turnos/:id/estado')
  @RequirePermiso('registrar_ventas')
  estado(@CurrentEmpresa() empresa: EmpresaContext, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(z.object({ estado: z.enum(ESTADOS_TURNO) }))) body: { estado: (typeof ESTADOS_TURNO)[number] }) {
    return this.agenda.cambiarEstado(empresa.id, id, body.estado);
  }

  @Post('turnos/:id/cobrado')
  @RequirePermiso('registrar_ventas')
  cobrado(@CurrentEmpresa() empresa: EmpresaContext, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(z.object({ ventaId: z.uuid() }))) body: { ventaId: string }) {
    return this.agenda.marcarCobrado(empresa.id, id, body.ventaId);
  }

  @Post('turnos/:id/recordatorio')
  recordatorio(@CurrentEmpresa() empresa: EmpresaContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.agenda.recordatorio(empresa.id, id);
  }
}

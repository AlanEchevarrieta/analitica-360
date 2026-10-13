import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import type { EmpresaContext, UsuarioContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireFuncion } from '../../common/decorators/funcion.decorator.js';
import { RequirePermiso } from '../../common/decorators/permiso.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { FORMAS_VENTA } from '../ventas/ventas.util.js';
import { AbonosService, type CobroAbonoInput, type PlanAbonoInput } from './abonos.service.js';
import { TIPOS_ABONO, type EstadoAbono } from './abonos.util.js';

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (AAAA-MM-DD)');
const planSchema = z.object({
  nombre: z.string().trim().min(1, 'Poné un nombre').max(80),
  tipo: z.enum(TIPOS_ABONO),
  precio: z.number().positive('El precio tiene que ser mayor a $0').max(100_000_000),
  sesiones: z.number().int().min(1).max(500).nullable().optional(),
  vigenciaDias: z.number().int().min(1).max(730).nullable().optional(),
  activo: z.boolean().optional(),
  actualizarAbonos: z.boolean().optional(),
});
const cobroSchema = z.object({
  formaPago: z.enum(FORMAS_VENTA),
  desde: fecha.nullable().optional(),
  cuotas: z.number().int().positive().optional(),
  coeficienteInteres: z.number().nonnegative().optional(),
  ubicacionOrigen: z.string().trim().nullable().optional(),
});
const crearSchema = z.object({
  clienteId: z.uuid(),
  planId: z.uuid(),
  precio: z.number().positive().max(100_000_000).nullable().optional(),
  notas: z.string().trim().max(500).nullable().optional(),
  cobro: cobroSchema.nullable().optional(),
});
const editarSchema = z.object({ precio: z.number().positive().max(100_000_000), notas: z.string().trim().max(500).nullable().optional() });
const usarSchema = z.object({ turnoId: z.uuid().nullable().optional(), nota: z.string().trim().max(200).nullable().optional() });
const FILTROS = ['todos', 'sin_cobrar', 'al_dia', 'por_vencer', 'vencido', 'sin_sesiones', 'baja', 'con_deuda'] as const;
const listarSchema = z.object({ estado: z.enum(FILTROS).default('todos') });

/** Abonos (plan Pro). Los planes los arma el dueño; cobrar y anotar sesiones, quien vende. */
@Controller('abonos')
@RequireFuncion('abonos')
export class AbonosController {
  constructor(private readonly abonos: AbonosService) {}

  @Get('planes')
  planes(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.abonos.planes(empresa.id);
  }

  @Post('planes')
  @Roles('dueno')
  crearPlan(@CurrentEmpresa() empresa: EmpresaContext, @Body(new ZodValidationPipe(planSchema)) body: PlanAbonoInput) {
    return this.abonos.crearPlan(empresa.id, body);
  }

  @Put('planes/:id')
  @Roles('dueno')
  editarPlan(@CurrentEmpresa() empresa: EmpresaContext, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(planSchema)) body: PlanAbonoInput) {
    return this.abonos.editarPlan(empresa.id, id, body);
  }

  @Delete('planes/:id')
  @Roles('dueno')
  borrarPlan(@CurrentEmpresa() empresa: EmpresaContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.abonos.borrarPlan(empresa.id, id);
  }

  @Get()
  listar(@CurrentEmpresa() empresa: EmpresaContext, @Query(new ZodValidationPipe(listarSchema)) q: { estado: EstadoAbono | 'todos' | 'con_deuda' }) {
    return this.abonos.listar(empresa.id, q.estado);
  }

  @Get('cliente/:clienteId')
  delCliente(@CurrentEmpresa() empresa: EmpresaContext, @Param('clienteId', new ParseUUIDPipe()) clienteId: string) {
    return this.abonos.delCliente(empresa.id, clienteId);
  }

  @Get(':id')
  ficha(@CurrentEmpresa() empresa: EmpresaContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.abonos.ficha(empresa.id, id);
  }

  @Post()
  @RequirePermiso('registrar_ventas')
  crear(@CurrentEmpresa() empresa: EmpresaContext, @CurrentUser() usuario: UsuarioContext, @Body(new ZodValidationPipe(crearSchema)) body: z.infer<typeof crearSchema>) {
    return this.abonos.crear(empresa.id, usuario.id, body as Parameters<AbonosService['crear']>[2]);
  }

  @Put(':id')
  @RequirePermiso('registrar_ventas')
  editar(@CurrentEmpresa() empresa: EmpresaContext, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(editarSchema)) body: z.infer<typeof editarSchema>) {
    return this.abonos.editar(empresa.id, id, body);
  }

  @Post(':id/cobrar')
  @RequirePermiso('registrar_ventas')
  cobrar(@CurrentEmpresa() empresa: EmpresaContext, @CurrentUser() usuario: UsuarioContext, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(cobroSchema)) body: CobroAbonoInput) {
    return this.abonos.cobrar(empresa.id, usuario.id, id, body);
  }

  @Post(':id/usar')
  @RequirePermiso('registrar_ventas')
  usar(@CurrentEmpresa() empresa: EmpresaContext, @CurrentUser() usuario: UsuarioContext, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(usarSchema)) body: z.infer<typeof usarSchema>) {
    return this.abonos.usar(empresa.id, usuario.id, id, body);
  }

  @Delete(':id/usos/:usoId')
  @RequirePermiso('registrar_ventas')
  deshacerUso(@CurrentEmpresa() empresa: EmpresaContext, @Param('id', new ParseUUIDPipe()) id: string, @Param('usoId', new ParseUUIDPipe()) usoId: string) {
    return this.abonos.deshacerUso(empresa.id, id, usoId);
  }

  @Post(':id/baja')
  @RequirePermiso('registrar_ventas')
  baja(@CurrentEmpresa() empresa: EmpresaContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.abonos.baja(empresa.id, id, false);
  }

  @Post(':id/reactivar')
  @RequirePermiso('registrar_ventas')
  reactivar(@CurrentEmpresa() empresa: EmpresaContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.abonos.baja(empresa.id, id, true);
  }

  @Post(':id/mensaje')
  mensaje(@CurrentEmpresa() empresa: EmpresaContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.abonos.mensaje(empresa.id, id);
  }
}

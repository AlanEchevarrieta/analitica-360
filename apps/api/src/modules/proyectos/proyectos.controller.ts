import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import type { EmpresaContext, UsuarioContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireFuncion } from '../../common/decorators/funcion.decorator.js';
import { RequirePermiso } from '../../common/decorators/permiso.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ProyectosService, type CrearProyectoInput } from './proyectos.service.js';

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (AAAA-MM-DD)');
const texto = (max: number) => z.string().trim().max(max).nullable().optional();

const etapaCrearSchema = z.object({
  nombre: z.string().trim().min(1, 'Poné el nombre de la etapa').max(120),
  aprobacion: z.enum(['ninguna', 'interna', 'cliente', 'ambas']).default('ninguna'),
  diasObjetivo: z.number().int().min(1).max(365).nullable().optional(),
  fechaObjetivo: fecha.nullable().optional(),
  responsableId: z.uuid().nullable().optional(),
  aprobadorInternoId: z.uuid().nullable().optional(),
});

const crearProyectoSchema = z.object({
  nombre: z.string().trim().min(1, 'Poné el nombre del proyecto').max(200),
  clienteId: z.uuid().nullable().optional(),
  clienteNombre: texto(160),
  descripcion: texto(4000),
  plantillaId: z.uuid().nullable().optional(),
  etapas: z.array(etapaCrearSchema).max(40).optional(),
  responsableId: z.uuid().nullable().optional(),
  miembros: z.array(z.uuid()).max(50).default([]),
  fechaInicio: fecha,
  fechaComprometida: fecha.nullable().optional(),
  montoAcordado: z.number().min(0).max(1_000_000_000).nullable().optional(),
});

const desdePresupuestoSchema = crearProyectoSchema.omit({
  clienteId: true,
  clienteNombre: true,
  montoAcordado: true,
});

const editarProyectoSchema = z.object({
  nombre: z.string().trim().min(1).max(200).optional(),
  clienteId: z.uuid().nullable().optional(),
  clienteNombre: texto(160),
  descripcion: texto(4000),
  responsableId: z.uuid().nullable().optional(),
  miembros: z.array(z.uuid()).max(50).optional(),
  fechaInicio: fecha.optional(),
  fechaComprometida: fecha.nullable().optional(),
  montoAcordado: z.number().min(0).max(1_000_000_000).nullable().optional(),
});

const editarEtapaSchema = z.object({
  nombre: z.string().trim().min(1).max(120).optional(),
  responsableId: z.uuid().nullable().optional(),
  aprobadorInternoId: z.uuid().nullable().optional(),
  fechaObjetivo: fecha.nullable().optional(),
});

const agregarEtapaSchema = z.object({
  nombre: z.string().trim().min(1, 'Poné el nombre de la etapa').max(120),
  aprobacion: z.enum(['ninguna', 'interna', 'cliente', 'ambas']).default('ninguna'),
  responsableId: z.uuid().nullable().optional(),
  aprobadorInternoId: z.uuid().nullable().optional(),
  fechaObjetivo: fecha.nullable().optional(),
  orden: z.number().int().min(1).max(100).optional(),
});

const accionEtapaSchema = z.object({
  accion: z.enum(['empezar', 'enviar_revision', 'terminar', 'omitir']),
  nota: texto(500),
});

const aprobacionInternaSchema = z.object({
  resultado: z.enum(['aprobada', 'cambios']),
  version: z.number().int().min(1),
  comentario: texto(2000),
});

const respuestaClienteSchema = z.object({
  resultado: z.enum(['aprobada', 'cambios']),
  version: z.number().int().min(1),
  aprobadorNombre: z.string().trim().min(1, 'Poné quién aprobó o respondió').max(160),
  medio: z.enum(['whatsapp', 'email', 'reunion', 'en_persona', 'link']),
  aprobadoEn: z.string().trim().min(1),
  comentario: texto(2000),
  evidenciaUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => !v || v.startsWith('https://'), {
      message: 'El link de evidencia tiene que empezar con https://',
    })
    .nullable()
    .optional(),
});

const estadoProyectoSchema = z.object({
  estado: z.enum(['pausado', 'activo', 'terminado', 'cancelado']),
  motivo: texto(300),
});

@Controller('proyectos')
@RequireFuncion('proyectos')
export class ProyectosController {
  constructor(private readonly service: ProyectosService) {}

  @Get()
  listar(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Query('estado') estado?: string,
    @Query('responsableId') responsableId?: string,
    @Query('clienteId') clienteId?: string,
    @Query('atrasados') atrasados?: string,
  ) {
    return this.service.listar(empresa.id, { estado, responsableId, clienteId, atrasados });
  }

  @Get('tablero')
  tablero(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Query('responsableId') responsableId?: string,
    @Query('clienteId') clienteId?: string,
    @Query('atrasados') atrasados?: string,
  ) {
    return this.service.tablero(empresa.id, { responsableId, clienteId, atrasados });
  }

  @Get('metricas')
  metricas(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.service.metricas(empresa.id, desde, hasta);
  }

  @Get('responsables')
  responsables(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.service.responsables(empresa.id);
  }

  @Get(':id')
  ficha(@CurrentEmpresa() empresa: EmpresaContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.ficha(empresa.id, id);
  }

  @Post()
  @RequirePermiso('registrar_ventas')
  crear(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @Body(new ZodValidationPipe(crearProyectoSchema)) body: CrearProyectoInput,
  ) {
    return this.service.crear(empresa.id, usuario.id, body);
  }

  @Post('desde-presupuesto/:presupuestoId')
  @RequirePermiso('registrar_ventas')
  desdePresupuesto(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @Param('presupuestoId', new ParseUUIDPipe()) presupuestoId: string,
    @Body(new ZodValidationPipe(desdePresupuestoSchema)) body: z.infer<typeof desdePresupuestoSchema>,
  ) {
    return this.service.desdePresupuesto(empresa.id, usuario.id, presupuestoId, body);
  }

  @Put(':id')
  @RequirePermiso('registrar_ventas')
  editar(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(editarProyectoSchema)) body: z.infer<typeof editarProyectoSchema>,
  ) {
    return this.service.editar(empresa.id, usuario.id, id, body);
  }

  @Put(':id/etapas/:etapaId')
  @RequirePermiso('registrar_ventas')
  editarEtapa(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('etapaId', new ParseUUIDPipe()) etapaId: string,
    @Body(new ZodValidationPipe(editarEtapaSchema)) body: z.infer<typeof editarEtapaSchema>,
  ) {
    return this.service.editarEtapa(empresa.id, usuario.id, id, etapaId, body);
  }

  @Post(':id/etapas')
  @RequirePermiso('registrar_ventas')
  agregarEtapa(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(agregarEtapaSchema)) body: z.infer<typeof agregarEtapaSchema>,
  ) {
    return this.service.agregarEtapa(empresa.id, usuario.id, id, body);
  }

  @Post(':id/etapas/:etapaId/accion')
  @HttpCode(200)
  @RequirePermiso('registrar_ventas')
  accionEtapa(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('etapaId', new ParseUUIDPipe()) etapaId: string,
    @Body(new ZodValidationPipe(accionEtapaSchema)) body: z.infer<typeof accionEtapaSchema>,
  ) {
    return this.service.accionEtapa(empresa.id, usuario, id, etapaId, body);
  }

  @Post(':id/etapas/:etapaId/aprobacion-interna')
  @HttpCode(200)
  aprobacionInterna(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('etapaId', new ParseUUIDPipe()) etapaId: string,
    @Body(new ZodValidationPipe(aprobacionInternaSchema)) body: z.infer<typeof aprobacionInternaSchema>,
  ) {
    return this.service.aprobacionInterna(empresa.id, usuario, id, etapaId, body);
  }

  @Post(':id/etapas/:etapaId/respuesta-cliente')
  @HttpCode(200)
  @RequirePermiso('registrar_ventas')
  respuestaCliente(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('etapaId', new ParseUUIDPipe()) etapaId: string,
    @Body(new ZodValidationPipe(respuestaClienteSchema)) body: z.infer<typeof respuestaClienteSchema>,
  ) {
    return this.service.respuestaCliente(empresa.id, usuario, id, etapaId, body);
  }

  @Post(':id/estado')
  @HttpCode(200)
  @RequirePermiso('registrar_ventas')
  cambiarEstado(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(estadoProyectoSchema)) body: z.infer<typeof estadoProyectoSchema>,
  ) {
    return this.service.cambiarEstado(empresa.id, usuario.id, id, body);
  }
}

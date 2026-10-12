import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import type { EmpresaContext, UsuarioContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireFuncion } from '../../common/decorators/funcion.decorator.js';
import { RequirePermiso } from '../../common/decorators/permiso.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { FORMAS_PAGO, FORMAS_VENTA } from '../ventas/ventas.util.js';
import { OrdenesTrabajoService, type OrdenTrabajoInput } from './ordenes-trabajo.service.js';
import { ESTADOS_MANUALES } from './ordenes-trabajo.util.js';

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (AAAA-MM-DD)');
const texto = (max: number) => z.string().trim().max(max).nullable().optional();
const item = z.object({ productoId: z.uuid(), varianteId: z.uuid().nullable().optional(), cantidad: z.number().int().min(1).max(100_000), precioUnitario: z.number().min(0).max(1_000_000_000) });
const datosBase = {
  clienteTelefono: texto(40),
  equipo: z.string().trim().min(1, 'Contá qué deja el cliente (equipo o trabajo)').max(300),
  problema: texto(2000),
  notasInternas: texto(2000),
  responsableId: z.uuid().nullable().optional(),
  fechaPrometida: fecha.nullable().optional(),
};
const ordenSchema = z.object({
  ...datosBase,
  clienteId: z.uuid().nullable().optional(),
  clienteNombre: texto(160),
  items: z.array(item).max(300).default([]),
  descuento: z.number().min(0).max(1_000_000_000).default(0),
  senia: z.object({ monto: z.number().positive().max(1_000_000_000), formaPago: z.enum(FORMAS_PAGO) }).nullable().optional(),
});
const desdePresupuestoSchema = z.object(datosBase);
const estadoSchema = z.object({ estado: z.enum(ESTADOS_MANUALES), nota: texto(300) });
const entregaSchema = z.object({
  formaPago: z.enum(FORMAS_VENTA),
  cuotas: z.number().int().min(1).max(60).default(1),
  coeficienteInteres: z.number().min(0).max(500).default(0),
  ubicacionOrigen: z.string().trim().max(120).nullable().optional(),
});
const cancelarSchema = z.object({ motivo: z.string().trim().min(1, 'Contá por qué se cancela').max(300) });

/** Órdenes de trabajo (plan Pro). El comprobante en PDF sale por /documentos/orden_trabajo/:id. */
@Controller('ordenes-trabajo')
@RequireFuncion('ordenes_trabajo')
export class OrdenesTrabajoController {
  constructor(private readonly ordenes: OrdenesTrabajoService) {}

  @Get()
  listar(@CurrentEmpresa() empresa: EmpresaContext, @Query('estado') estado?: string) {
    return this.ordenes.listar(empresa.id, estado?.slice(0, 20));
  }

  /** Quiénes pueden atender una orden (los usuarios activos de la empresa). */
  @Get('responsables')
  responsables(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.ordenes.responsables(empresa.id);
  }

  @Get(':id')
  ficha(@CurrentEmpresa() empresa: EmpresaContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.ordenes.ficha(empresa.id, id);
  }

  @Post()
  @RequirePermiso('registrar_ventas')
  crear(@CurrentEmpresa() empresa: EmpresaContext, @CurrentUser() usuario: UsuarioContext, @Body(new ZodValidationPipe(ordenSchema)) body: OrdenTrabajoInput) {
    return this.ordenes.crear(empresa.id, usuario.id, body);
  }

  @Post('desde-presupuesto/:presupuestoId')
  @RequirePermiso('registrar_ventas')
  desdePresupuesto(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @Param('presupuestoId', new ParseUUIDPipe()) presupuestoId: string,
    @Body(new ZodValidationPipe(desdePresupuestoSchema)) body: z.infer<typeof desdePresupuestoSchema>,
  ) {
    return this.ordenes.desdePresupuesto(empresa.id, usuario.id, presupuestoId, body);
  }

  @Put(':id')
  @RequirePermiso('registrar_ventas')
  editar(@CurrentEmpresa() empresa: EmpresaContext, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(ordenSchema.omit({ senia: true }))) body: OrdenTrabajoInput) {
    return this.ordenes.editar(empresa.id, id, body);
  }

  @Post(':id/estado')
  @RequirePermiso('registrar_ventas')
  estado(@CurrentEmpresa() empresa: EmpresaContext, @CurrentUser() usuario: UsuarioContext, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(estadoSchema)) body: z.infer<typeof estadoSchema>) {
    return this.ordenes.cambiarEstado(empresa.id, id, usuario.id, body.estado, body.nota);
  }

  @Post(':id/entregar')
  @RequirePermiso('registrar_ventas')
  entregar(@CurrentEmpresa() empresa: EmpresaContext, @CurrentUser() usuario: UsuarioContext, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(entregaSchema)) body: z.infer<typeof entregaSchema>) {
    return this.ordenes.entregar(empresa.id, id, usuario.id, body);
  }

  @Post(':id/cancelar')
  @RequirePermiso('registrar_ventas')
  cancelar(@CurrentEmpresa() empresa: EmpresaContext, @CurrentUser() usuario: UsuarioContext, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(cancelarSchema)) body: z.infer<typeof cancelarSchema>) {
    return this.ordenes.cancelar(empresa.id, id, usuario.id, body.motivo);
  }
}

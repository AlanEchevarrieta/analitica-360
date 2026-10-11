import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { z } from 'zod';
import type { EmpresaContext, UsuarioContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireFuncion } from '../../common/decorators/funcion.decorator.js';
import { RequirePermiso } from '../../common/decorators/permiso.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { PresupuestosService, type PresupuestoInput } from './presupuestos.service.js';

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (AAAA-MM-DD)');
const presupuestoSchema = z.object({
  clienteId: z.uuid().nullable().optional(),
  clienteNombre: z.string().trim().max(160).nullable().optional(),
  items: z
    .array(z.object({ productoId: z.uuid(), varianteId: z.uuid().nullable().optional(), cantidad: z.number().int().min(1).max(1_000_000), precioUnitario: z.number().min(0).max(1_000_000_000) }))
    .min(1, 'Agregá al menos un producto')
    .max(300),
  descuento: z.number().min(0).max(1_000_000_000).default(0),
  notas: z.string().trim().max(2000).nullable().optional(),
  validoHasta: fecha.nullable().optional(),
});
const estadoSchema = z.object({ estado: z.enum(['pendiente', 'rechazado']) });
const aceptarSchema = z.object({ ventaId: z.uuid() });

/** Presupuestos para clientes (plan Pro). El PDF, el link y el email salen de /documentos/presupuesto/:id. */
@Controller('presupuestos')
@RequireFuncion('presupuestos')
export class PresupuestosController {
  constructor(private readonly presupuestos: PresupuestosService) {}

  @Get()
  listar(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.presupuestos.listar(empresa.id);
  }

  @Get(':id')
  ficha(@CurrentEmpresa() empresa: EmpresaContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.presupuestos.ficha(empresa.id, id);
  }

  @Post()
  @RequirePermiso('registrar_ventas')
  crear(@CurrentEmpresa() empresa: EmpresaContext, @CurrentUser() usuario: UsuarioContext, @Body(new ZodValidationPipe(presupuestoSchema)) body: PresupuestoInput) {
    return this.presupuestos.crear(empresa.id, usuario.id, body);
  }

  @Put(':id')
  @RequirePermiso('registrar_ventas')
  editar(@CurrentEmpresa() empresa: EmpresaContext, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(presupuestoSchema)) body: PresupuestoInput) {
    return this.presupuestos.editar(empresa.id, id, body);
  }

  @Post(':id/estado')
  @RequirePermiso('registrar_ventas')
  estado(@CurrentEmpresa() empresa: EmpresaContext, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(estadoSchema)) body: z.infer<typeof estadoSchema>) {
    return this.presupuestos.cambiarEstado(empresa.id, id, body.estado);
  }

  /** Después de registrar la venta que salió del presupuesto. */
  @Post(':id/aceptar')
  @RequirePermiso('registrar_ventas')
  aceptar(@CurrentEmpresa() empresa: EmpresaContext, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(aceptarSchema)) body: z.infer<typeof aceptarSchema>) {
    return this.presupuestos.aceptar(empresa.id, id, body.ventaId);
  }

  @Delete(':id')
  @RequirePermiso('registrar_ventas')
  borrar(@CurrentEmpresa() empresa: EmpresaContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.presupuestos.borrar(empresa.id, id);
  }
}

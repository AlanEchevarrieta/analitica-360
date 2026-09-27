import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import type { EmpresaContext, UsuarioContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModulo, RequirePermiso } from '../../common/decorators/permiso.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ProduccionService } from './produccion.service.js';

const recetaSchema = z.object({
  productoId: z.uuid(),
  varianteId: z.uuid().nullable().default(null),
  minutos: z.number().min(0).max(100_000).default(0),
  armarAlVender: z.boolean().default(false),
  notas: z.string().trim().max(500).nullable().default(null),
  items: z
    .array(z.object({ insumoId: z.uuid(), insumoVarianteId: z.uuid().nullable().default(null), cantidad: z.number().positive('Cada componente necesita una cantidad mayor a 0').max(1_000_000) }))
    .min(1, 'Agregá al menos un componente'),
});
const recetaQuery = z.object({ productoId: z.uuid(), varianteId: z.uuid().optional() });
const ordenSchema = z.object({
  productoId: z.uuid(),
  varianteId: z.uuid().nullable().default(null),
  cantidad: z.number().positive('La cantidad tiene que ser mayor a 0').max(1_000_000),
  ubicacion: z.string().trim().min(1).nullable().default(null),
  notas: z.string().trim().max(500).nullable().default(null),
  permitirFaltantes: z.boolean().default(false),
});
const previewQuery = z.object({ productoId: z.uuid(), varianteId: z.uuid().optional(), cantidad: z.coerce.number().positive() });

/** Producción: recetas (fichas de fabricación y kits) y órdenes de producción. */
@Controller('produccion')
@RequireModulo('produccion')
export class ProduccionController {
  constructor(private readonly service: ProduccionService) {}

  @Get('recetas')
  @RequirePermiso('ver_costos')
  recetas(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.service.listarRecetas(empresa.id);
  }

  @Get('receta')
  @RequirePermiso('ver_costos')
  receta(@CurrentEmpresa() empresa: EmpresaContext, @Query(new ZodValidationPipe(recetaQuery)) q: z.infer<typeof recetaQuery>) {
    return this.service.obtenerReceta(empresa.id, q.productoId, q.varianteId ?? null);
  }

  @Put('receta')
  @RequirePermiso('editar_productos')
  guardarReceta(@CurrentEmpresa() empresa: EmpresaContext, @Body(new ZodValidationPipe(recetaSchema)) body: z.infer<typeof recetaSchema>) {
    return this.service.guardarReceta(empresa.id, body);
  }

  @Delete('recetas/:id')
  @RequirePermiso('editar_productos')
  @HttpCode(204)
  eliminarReceta(@CurrentEmpresa() empresa: EmpresaContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.eliminarReceta(empresa.id, id);
  }

  @Get('ordenes')
  ordenes(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.service.listarOrdenes(empresa.id);
  }

  @Get('ordenes/previa')
  previa(@CurrentEmpresa() empresa: EmpresaContext, @Query(new ZodValidationPipe(previewQuery)) q: z.infer<typeof previewQuery>) {
    return this.service.previsualizar(empresa.id, q.productoId, q.varianteId ?? null, q.cantidad);
  }

  @Post('ordenes')
  crearOrden(@CurrentEmpresa() empresa: EmpresaContext, @CurrentUser() usuario: UsuarioContext, @Body(new ZodValidationPipe(ordenSchema)) body: z.infer<typeof ordenSchema>) {
    return this.service.crearOrden(empresa.id, usuario.id, body);
  }

  @Post('ordenes/:id/anular')
  @HttpCode(200)
  anular(@CurrentEmpresa() empresa: EmpresaContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.anularOrden(empresa.id, id);
  }
}

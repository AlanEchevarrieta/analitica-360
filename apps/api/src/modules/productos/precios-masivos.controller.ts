import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { z } from 'zod';
import type { EmpresaContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { RequireModulo, RequirePermiso } from '../../common/decorators/permiso.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { PreciosMasivosService } from './precios-masivos.service.js';

const preciosMasivosSchema = z
  .object({
    categoriaId: z.uuid().nullable().default(null),
    modo: z.enum(['porcentaje', 'margen']),
    valor: z.number(),
    redondeo: z.union([z.literal(0), z.literal(10), z.literal(50), z.literal(100), z.literal(500), z.literal(1000)]).default(0),
    /** false = solo vista previa (no guarda nada). */
    confirmar: z.boolean().default(false),
  })
  .refine((b) => (b.modo === 'porcentaje' ? b.valor > -90 && b.valor <= 500 && b.valor !== 0 : b.valor > 0 && b.valor < 95), {
    message: 'Porcentaje entre -90 y 500 (distinto de 0), o margen entre 1 y 94',
    path: ['valor'],
  });

/** Actualización masiva de precios (con vista previa antes de aplicar). */
@Controller('productos/precios')
@RequireModulo('productos')
export class PreciosMasivosController {
  constructor(private readonly service: PreciosMasivosService) {}

  @Post('masivo')
  @HttpCode(200)
  @RequirePermiso('editar_productos')
  ejecutar(@CurrentEmpresa() empresa: EmpresaContext, @Body(new ZodValidationPipe(preciosMasivosSchema)) b: z.infer<typeof preciosMasivosSchema>) {
    return this.service.ejecutar(empresa.id, b.categoriaId, { modo: b.modo, valor: b.valor, redondeo: b.redondeo }, b.confirmar);
  }
}

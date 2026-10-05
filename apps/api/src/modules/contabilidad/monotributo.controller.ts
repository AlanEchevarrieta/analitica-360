import { Body, Controller, Get, HttpCode, Put } from '@nestjs/common';
import { z } from 'zod';
import type { EmpresaContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { RequireAdminApp } from '../../common/decorators/admin-app.decorator.js';
import { RequireModulo } from '../../common/decorators/permiso.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { MonotributoService } from './monotributo.service.js';
import { CATEGORIAS_MONOTRIBUTO } from './monotributo.util.js';
import { CacheLectura } from '../../common/cache/cache-lecturas.js';

/** Estado del monotributo de la empresa: facturación de 12 meses contra el tope de su categoría. */
@Controller('monotributo')
@RequireModulo('contabilidad')
@CacheLectura()
export class MonotributoController {
  constructor(private readonly service: MonotributoService) {}

  @Get()
  estado(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.service.estado(empresa.id);
  }
}

const guardarTopesSchema = z.object({
  vigencia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)'),
  topes: z.array(z.object({ categoria: z.enum(CATEGORIAS_MONOTRIBUTO), topeAnual: z.number().positive() })).length(11),
});

/** Consola: los topes los carga el dueño del producto una vez por semestre para todos los clientes. */
@Controller('admin/monotributo')
@RequireAdminApp()
export class AdminMonotributoController {
  constructor(private readonly service: MonotributoService) {}

  @Get('topes')
  topes() {
    return this.service.listarTopes();
  }

  @Put('topes')
  @HttpCode(204)
  async guardar(@Body(new ZodValidationPipe(guardarTopesSchema)) body: z.infer<typeof guardarTopesSchema>) {
    await this.service.guardarTopes(body.vigencia, body.topes);
  }
}

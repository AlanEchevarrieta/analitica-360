import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { z } from 'zod';
import type { EmpresaContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ListasPreciosService } from './listas-precios.service.js';

const guardarListaSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(60),
  ajustePct: z.number().min(-90, 'El ajuste va de -90% a +300%').max(300, 'El ajuste va de -90% a +300%').refine((n) => n !== 0, 'Poné un ajuste distinto de 0%'),
  redondeo: z.union([z.literal(0), z.literal(10), z.literal(50), z.literal(100), z.literal(500), z.literal(1000)]).default(0),
});
type GuardarLista = z.infer<typeof guardarListaSchema>;

/** Listas de precios (mayorista, revendedor…): las lee cualquier usuario, las cambia el dueño. */
@Controller('listas-precios')
export class ListasPreciosController {
  constructor(private readonly service: ListasPreciosService) {}

  @Get()
  listar(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.service.listar(empresa.id);
  }

  @Post()
  @Roles('dueno')
  crear(@CurrentEmpresa() empresa: EmpresaContext, @Body(new ZodValidationPipe(guardarListaSchema)) body: GuardarLista) {
    return this.service.crear(empresa.id, body);
  }

  @Put(':id')
  @Roles('dueno')
  actualizar(@CurrentEmpresa() empresa: EmpresaContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(guardarListaSchema)) body: GuardarLista) {
    return this.service.actualizar(empresa.id, id, body);
  }

  @Delete(':id')
  @Roles('dueno')
  eliminar(@CurrentEmpresa() empresa: EmpresaContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.eliminar(empresa.id, id);
  }
}

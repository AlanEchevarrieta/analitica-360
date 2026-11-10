import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { z } from 'zod';
import type { EmpresaContext, UsuarioContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireFuncion } from '../../common/decorators/funcion.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { PlantillasProyectoService, type PlantillaProyectoInput } from './plantillas-proyecto.service.js';

const etapaPlantillaSchema = z.object({
  nombre: z.string().trim().min(1, 'Poné el nombre de la etapa').max(120),
  diasObjetivo: z.number().int().min(1).max(365).nullable().optional(),
  aprobacion: z.enum(['ninguna', 'interna', 'cliente', 'ambas']).default('ninguna'),
  aprobadorInternoId: z.uuid().nullable().optional(),
});

const plantillaSchema = z.object({
  nombre: z.string().trim().min(1, 'Poné el nombre de la plantilla').max(120),
  descripcion: z.string().trim().max(500).nullable().optional(),
  orden: z.number().int().min(0).max(1000).optional(),
  etapas: z.array(etapaPlantillaSchema).min(1, 'Agregá al menos una etapa').max(30),
});

@Controller('plantillas-proyecto')
@RequireFuncion('proyectos')
export class PlantillasProyectoController {
  constructor(private readonly service: PlantillasProyectoService) {}

  @Get()
  listar(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.service.listar(empresa.id);
  }

  @Post()
  crear(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @Body(new ZodValidationPipe(plantillaSchema)) body: PlantillaProyectoInput,
  ) {
    return this.service.crear(empresa.id, usuario.rol === 'dueno', body);
  }

  @Put(':id')
  editar(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(plantillaSchema)) body: PlantillaProyectoInput,
  ) {
    return this.service.editar(empresa.id, usuario.rol === 'dueno', id, body);
  }

  @Post(':id/archivar')
  @HttpCode(200)
  archivar(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.archivar(empresa.id, usuario.rol === 'dueno', id);
  }
}

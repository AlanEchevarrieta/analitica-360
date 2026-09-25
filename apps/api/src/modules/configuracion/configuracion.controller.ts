import { BadRequestException, Body, Controller, Get, Inject, Patch } from '@nestjs/common';
import type { EmpresaContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { actualizarConfiguracionSchema, type ActualizarConfiguracionInput } from './configuracion.dto.js';
import { CONFIGURACION_REPOSITORY, type ConfiguracionRepository } from './configuracion.repository.js';

const MOTIVO = {
  ubicacion_invalida: 'Esa ubicación no existe en tu empresa',
  usuario_invalido: 'Hay un usuario que no pertenece a tu empresa',
} as const;

/** Configuración de la empresa: la lee cualquier usuario, la cambia solo el dueño. */
@Controller('configuracion')
export class ConfiguracionController {
  constructor(@Inject(CONFIGURACION_REPOSITORY) private readonly repository: ConfiguracionRepository) {}

  @Get()
  obtener(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.repository.obtener(empresa.id);
  }

  @Patch()
  @Roles('dueno')
  async actualizar(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Body(new ZodValidationPipe(actualizarConfiguracionSchema)) body: ActualizarConfiguracionInput,
  ) {
    const resultado = await this.repository.actualizar(empresa.id, body);
    if (!resultado.ok) throw new BadRequestException(MOTIVO[resultado.motivo]);
    return resultado.configuracion;
  }
}

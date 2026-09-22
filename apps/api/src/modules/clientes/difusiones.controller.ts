import { Body, Controller, Get, Post } from '@nestjs/common';
import type { EmpresaContext, UsuarioContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModulo, RequirePermiso } from '../../common/decorators/permiso.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ClientesService } from './clientes.service.js';
import { guardarDifusionSchema, type GuardarDifusionInput } from './clientes.dto.js';

@Controller('difusiones')
@RequireModulo('clientes')
export class DifusionesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Get()
  listar(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.clientesService.listarDifusiones(empresa.id);
  }

  @Get('cumpleanos-mes')
  cumpleanosMes(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.clientesService.cumpleanosMes(empresa.id);
  }

  @Post()
  @RequirePermiso('gestionar_clientes')
  guardar(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @Body(new ZodValidationPipe(guardarDifusionSchema)) body: GuardarDifusionInput,
  ) {
    return this.clientesService.guardarDifusion(empresa.id, usuario.id, body);
  }
}

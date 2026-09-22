import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { EmpresaContext, UsuarioContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModulo, RequirePermiso } from '../../common/decorators/permiso.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ClientesService } from './clientes.service.js';
import {
  agregarInteraccionSchema,
  cumpleanosProximosQuerySchema,
  guardarClienteSchema,
  type AgregarInteraccionInput,
  type CumpleanosProximosQuery,
  type GuardarClienteInput,
} from './clientes.dto.js';

@Controller('clientes')
@RequireModulo('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Get()
  listar(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.clientesService.listar(empresa.id);
  }

  @Get('segmentos')
  segmentos(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.clientesService.segmentos(empresa.id);
  }

  @Get('cumpleanos-proximos')
  cumpleanosProximos(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Query(new ZodValidationPipe(cumpleanosProximosQuerySchema)) query: CumpleanosProximosQuery,
  ) {
    return this.clientesService.cumpleanosProximos(empresa.id, query.horizonteDias);
  }

  @Get(':id')
  ficha(@CurrentEmpresa() empresa: EmpresaContext, @Param('id') id: string) {
    return this.clientesService.ficha(empresa.id, id);
  }

  @Post()
  @RequirePermiso('gestionar_clientes')
  crear(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Body(new ZodValidationPipe(guardarClienteSchema)) body: GuardarClienteInput,
  ) {
    return this.clientesService.crear(empresa.id, body);
  }

  @Patch(':id')
  @RequirePermiso('gestionar_clientes')
  actualizar(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(guardarClienteSchema)) body: GuardarClienteInput,
  ) {
    return this.clientesService.actualizar(empresa.id, id, body);
  }

  @Post(':id/interacciones')
  @RequirePermiso('gestionar_clientes')
  agregarInteraccion(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(agregarInteraccionSchema)) body: AgregarInteraccionInput,
  ) {
    return this.clientesService.agregarInteraccion(empresa.id, usuario.id, id, body);
  }
}

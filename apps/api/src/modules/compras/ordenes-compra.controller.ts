import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { EmpresaContext, UsuarioContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModulo } from '../../common/decorators/permiso.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { OrdenesCompraService } from './ordenes-compra.service.js';
import {
  actualizarEstadoOcSchema,
  guardarOrdenCompraSchema,
  listarOrdenesCompraQuerySchema,
  registrarRecepcionOcSchema,
  type ActualizarEstadoOcInput,
  type GuardarOrdenCompraInput,
  type ListarOrdenesCompraQuery,
  type RegistrarRecepcionOcInput,
} from './ordenes-compra.dto.js';

@Controller('ordenes-compra')
@RequireModulo('compras')
export class OrdenesCompraController {
  constructor(private readonly ordenesCompraService: OrdenesCompraService) {}

  @Get()
  listar(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Query(new ZodValidationPipe(listarOrdenesCompraQuerySchema)) query: ListarOrdenesCompraQuery,
  ) {
    return this.ordenesCompraService.listar(empresa.id, query);
  }

  @Get(':id')
  ficha(@CurrentEmpresa() empresa: EmpresaContext, @Param('id') id: string) {
    return this.ordenesCompraService.ficha(empresa.id, id);
  }

  @Post()
  crear(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Body(new ZodValidationPipe(guardarOrdenCompraSchema)) body: GuardarOrdenCompraInput,
  ) {
    return this.ordenesCompraService.crear(empresa.id, body);
  }

  @Patch(':id')
  actualizar(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(guardarOrdenCompraSchema)) body: GuardarOrdenCompraInput,
  ) {
    return this.ordenesCompraService.actualizar(empresa.id, id, body);
  }

  @Patch(':id/estado')
  actualizarEstado(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(actualizarEstadoOcSchema)) body: ActualizarEstadoOcInput,
  ) {
    return this.ordenesCompraService.actualizarEstado(empresa.id, id, body);
  }

  @Post(':id/recepcion')
  registrarRecepcion(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(registrarRecepcionOcSchema)) body: RegistrarRecepcionOcInput,
  ) {
    return this.ordenesCompraService.registrarRecepcion(empresa.id, usuario.id, id, body);
  }
}

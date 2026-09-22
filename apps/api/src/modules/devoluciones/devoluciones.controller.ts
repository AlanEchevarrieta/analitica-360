import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import type { EmpresaContext, UsuarioContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModulo } from '../../common/decorators/permiso.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { DevolucionesService } from './devoluciones.service.js';
import {
  buscarVentasQuerySchema,
  listarDevolucionesQuerySchema,
  registrarDevolucionSchema,
  type BuscarVentasQuery,
  type ListarDevolucionesQuery,
  type RegistrarDevolucionInput,
} from './devoluciones.dto.js';

@Controller('devoluciones')
@RequireModulo('ventas')
export class DevolucionesController {
  constructor(private readonly devolucionesService: DevolucionesService) {}

  @Get()
  listar(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Query(new ZodValidationPipe(listarDevolucionesQuerySchema)) query: ListarDevolucionesQuery,
  ) {
    return this.devolucionesService.listar(empresa.id, query);
  }

  @Get('buscar-ventas')
  buscarVentas(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Query(new ZodValidationPipe(buscarVentasQuerySchema)) query: BuscarVentasQuery,
  ) {
    return this.devolucionesService.buscarVentas(empresa.id, query);
  }

  @Get(':id')
  ficha(@CurrentEmpresa() empresa: EmpresaContext, @Param('id') id: string) {
    return this.devolucionesService.ficha(empresa.id, id);
  }

  @Post()
  registrar(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @Body(new ZodValidationPipe(registrarDevolucionSchema)) body: RegistrarDevolucionInput,
  ) {
    return this.devolucionesService.registrar(empresa.id, usuario.id, body);
  }

  @Post(':id/procesar')
  procesar(@CurrentEmpresa() empresa: EmpresaContext, @Param('id') id: string) {
    return this.devolucionesService.procesar(empresa.id, id);
  }

  @Post(':id/cancelar')
  cancelar(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @Param('id') id: string,
  ) {
    return this.devolucionesService.cancelar(empresa.id, usuario.id, id);
  }
}

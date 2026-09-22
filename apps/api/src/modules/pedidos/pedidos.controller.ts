import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { EmpresaContext, UsuarioContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModulo, RequirePermiso } from '../../common/decorators/permiso.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { PedidosService } from './pedidos.service.js';
import {
  asignarPedidoSchema,
  crearPedidoSchema,
  guardarPreparacionItemSchema,
  listarPedidosQuerySchema,
  registrarDespachoSchema,
  type AsignarPedidoInput,
  type CrearPedidoInput,
  type GuardarPreparacionItemInput,
  type ListarPedidosQuery,
  type RegistrarDespachoInput,
} from './pedidos.dto.js';

@Controller('pedidos')
@RequireModulo('pedidos')
export class PedidosController {
  constructor(private readonly pedidosService: PedidosService) {}

  @Get()
  listar(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Query(new ZodValidationPipe(listarPedidosQuerySchema)) query: ListarPedidosQuery,
  ) {
    return this.pedidosService.listar(empresa.id, query);
  }

  @Get('colaboradores')
  colaboradores(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.pedidosService.colaboradoresActivos(empresa.id);
  }

  @Get(':id')
  ficha(@CurrentEmpresa() empresa: EmpresaContext, @Param('id') id: string) {
    return this.pedidosService.ficha(empresa.id, id);
  }

  @Post()
  @RequirePermiso('crear_pedidos')
  crear(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Body(new ZodValidationPipe(crearPedidoSchema)) body: CrearPedidoInput,
  ) {
    return this.pedidosService.crear(empresa.id, body);
  }

  @Patch(':id/asignar')
  asignar(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(asignarPedidoSchema)) body: AsignarPedidoInput,
  ) {
    return this.pedidosService.asignar(empresa.id, id, body);
  }

  @Patch(':id/items/:itemId/preparacion')
  @RequirePermiso('hacer_picking')
  guardarPreparacionItem(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body(new ZodValidationPipe(guardarPreparacionItemSchema)) body: GuardarPreparacionItemInput,
  ) {
    return this.pedidosService.guardarPreparacionItem(empresa.id, id, itemId, body);
  }

  @Post(':id/marcar-todo-preparado')
  @RequirePermiso('hacer_picking')
  marcarTodoPreparado(@CurrentEmpresa() empresa: EmpresaContext, @Param('id') id: string) {
    return this.pedidosService.marcarTodoPreparado(empresa.id, id);
  }

  @Post(':id/confirmar-listo-despacho')
  @RequirePermiso('hacer_picking')
  confirmarListoDespacho(@CurrentEmpresa() empresa: EmpresaContext, @Param('id') id: string) {
    return this.pedidosService.confirmarListoDespacho(empresa.id, id);
  }

  @Post(':id/despacho')
  @RequirePermiso('hacer_picking')
  registrarDespacho(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(registrarDespachoSchema)) body: RegistrarDespachoInput,
  ) {
    return this.pedidosService.registrarDespacho(empresa.id, usuario.id, id, body);
  }

  @Post(':id/con-transportista')
  marcarConTransportista(@CurrentEmpresa() empresa: EmpresaContext, @Param('id') id: string) {
    return this.pedidosService.marcarConTransportista(empresa.id, id);
  }

  @Post(':id/entregado')
  marcarEntregado(@CurrentEmpresa() empresa: EmpresaContext, @Param('id') id: string) {
    return this.pedidosService.marcarEntregado(empresa.id, id);
  }

  @Post(':id/cancelar')
  @RequirePermiso('crear_pedidos')
  cancelar(@CurrentEmpresa() empresa: EmpresaContext, @Param('id') id: string) {
    return this.pedidosService.cancelar(empresa.id, id);
  }
}

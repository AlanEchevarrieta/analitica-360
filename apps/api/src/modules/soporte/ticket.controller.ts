import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import type { EmpresaContext, UsuarioContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireAdminApp } from '../../common/decorators/admin-app.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { TicketService } from './ticket.service.js';
import {
  cambiarEstadoTicketSchema,
  crearTicketSchema,
  responderTicketSchema,
  type CambiarEstadoTicketDto,
  type CrearTicketDto,
  type ResponderTicketDto,
} from './ticket.dto.js';

/**
 * Sin @RequireModulo en las rutas tenant: no hay claim 'soporte' en la
 * taxonomía de roles todavía y, más importante, la RLS real
 * (supabase/039_tickets_soporte.sql) no restringe por rol - cualquier
 * usuario autenticado de la empresa puede abrir/ver/responder tickets.
 * Mismo criterio que NotificacionesController. Las rutas /admin/* sí están
 * gateadas, con @RequireAdminApp() (puerto de es_admin_app()).
 *
 * Orden de rutas importa: los literales (no-leidos, banner-home, admin)
 * van antes de los `:id` genéricos para que Express no los confunda con un
 * id de ticket.
 */
@Controller('tickets')
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @Get()
  listar(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.ticketService.listar(empresa.id);
  }

  @Get('no-leidos')
  contarNoLeidos(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.ticketService.contarNoLeidos(empresa.id);
  }

  @Get('banner-home')
  bannerHome(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.ticketService.bannerHome(empresa.id);
  }

  @Get('admin')
  @RequireAdminApp()
  listarAdmin() {
    return this.ticketService.listarAdmin();
  }

  @Get('admin/:id')
  @RequireAdminApp()
  fichaAdmin(@Param('id') id: string) {
    return this.ticketService.fichaAdmin(id);
  }

  @Patch('admin/:id/estado')
  @RequireAdminApp()
  @HttpCode(204)
  async cambiarEstado(@Param('id') id: string, @Body(new ZodValidationPipe(cambiarEstadoTicketSchema)) body: CambiarEstadoTicketDto) {
    await this.ticketService.cambiarEstado(id, body.estado);
  }

  @Get(':id')
  ficha(@CurrentEmpresa() empresa: EmpresaContext, @Param('id') id: string) {
    return this.ticketService.ficha(empresa.id, id);
  }

  @Post()
  crear(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @Body(new ZodValidationPipe(crearTicketSchema)) body: CrearTicketDto,
  ) {
    return this.ticketService.crear(empresa.id, usuario.id, body);
  }

  @Post(':id/respuestas')
  responder(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(responderTicketSchema)) body: ResponderTicketDto,
  ) {
    return this.ticketService.responder(empresa.id, usuario.id, id, body.contenido);
  }

  @Post(':id/visto')
  @HttpCode(204)
  async marcarVisto(@CurrentEmpresa() empresa: EmpresaContext, @Param('id') id: string) {
    await this.ticketService.marcarVisto(empresa.id, id);
  }

  @Post('marcar-vistos')
  @HttpCode(204)
  async marcarTodosVistos(@CurrentEmpresa() empresa: EmpresaContext) {
    await this.ticketService.marcarTodosVistos(empresa.id);
  }
}

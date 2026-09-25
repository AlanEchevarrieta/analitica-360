import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { TiendaService } from './tienda.service.js';
import { crearPedidoTiendaSchema, type CrearPedidoTiendaInput } from './tienda.dto.js';

/**
 * API pública de la tienda online (sin Clerk): la consume el servidor de
 * cada tienda (ej. acacia-store) para leer el catálogo y crear pedidos con
 * origen 'tienda_online'. La empresa viaja en la URL porque no hay sesión.
 */
@Controller('tienda/:empresaId')
@Public()
export class TiendaController {
  constructor(private readonly tiendaService: TiendaService) {}

  @Get('catalogo')
  catalogo(@Param('empresaId', new ParseUUIDPipe()) empresaId: string) {
    return this.tiendaService.catalogo(empresaId);
  }

  @Post('pedidos')
  crearPedido(
    @Param('empresaId', new ParseUUIDPipe()) empresaId: string,
    @Body(new ZodValidationPipe(crearPedidoTiendaSchema)) body: CrearPedidoTiendaInput,
  ) {
    return this.tiendaService.crearPedido(empresaId, body);
  }
}

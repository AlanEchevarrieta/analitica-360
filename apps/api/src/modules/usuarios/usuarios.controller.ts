import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator.js';
import { InternalWebhookGuard } from './internal-webhook.guard.js';
import { UsuariosService } from './usuarios.service.js';
import type { ClerkWebhookEvent } from './clerk-webhook-event.types.js';

@Controller('internal')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  // @Public() lo excluye del ClerkAuthGuard global (no trae un JWT de
  // sesión de usuario) — la autenticación acá es el InternalWebhookGuard.
  @Public()
  @UseGuards(InternalWebhookGuard)
  @Post('clerk-webhook')
  @HttpCode(204)
  async recibirEventoClerk(@Body() event: ClerkWebhookEvent): Promise<void> {
    await this.usuariosService.procesarEventoClerk(event);
  }
}

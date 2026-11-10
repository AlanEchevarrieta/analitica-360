import { Body, Controller, Get, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireFuncion } from '../../common/decorators/funcion.decorator.js';
import type { EmpresaContext, UsuarioContext } from '../../common/auth/request-context.types.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CopilotIaService } from './copilot-ia.service.js';
import { copilotChatSchema, type CopilotChatDto } from './dto/copilot-chat.dto.js';
import { unwrapResult } from '../../common/result/error-mapper.js';

@Controller('copilot')
@RequireFuncion('copilot')
export class CopilotIaController {
  constructor(private readonly copilotService: CopilotIaService) {}

  @Post('chat')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async chat(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext | undefined,
    @Body(new ZodValidationPipe(copilotChatSchema)) body: CopilotChatDto,
  ) {
    const res = await this.copilotService.procesarMensaje(empresa.id, body, usuario?.id);
    return unwrapResult(res);
  }

  @Get('sugerencias')
  async sugerencias(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.copilotService.obtenerSugerencias(empresa.id);
  }
}

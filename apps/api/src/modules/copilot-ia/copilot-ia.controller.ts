import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import type { EmpresaContext } from '../../common/auth/request-context.types.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CopilotIaService } from './copilot-ia.service.js';
import { copilotChatSchema, type CopilotChatDto } from './dto/copilot-chat.dto.js';
import { unwrapResult } from '../../common/result/error-mapper.js';

@Controller('copilot')
export class CopilotIaController {
  constructor(private readonly copilotService: CopilotIaService) {}

  @Post('chat')
  async chat(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Body(new ZodValidationPipe(copilotChatSchema)) body: CopilotChatDto,
  ) {
    const res = await this.copilotService.procesarMensaje(empresa.id, body);
    return unwrapResult(res);
  }

  @Get('sugerencias')
  async sugerencias(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.copilotService.obtenerSugerencias(empresa.id);
  }
}

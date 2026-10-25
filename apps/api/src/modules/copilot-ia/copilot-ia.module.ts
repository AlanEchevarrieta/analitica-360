import { Module } from '@nestjs/common';
import { CopilotIaController } from './copilot-ia.controller.js';
import { CopilotIaService } from './copilot-ia.service.js';

@Module({
  controllers: [CopilotIaController],
  providers: [CopilotIaService],
  exports: [CopilotIaService],
})
export class CopilotIaModule {}

import { Module } from '@nestjs/common';
import { CopilotIaController } from './copilot-ia.controller.js';
import { CopilotIaService } from './copilot-ia.service.js';
import { LakeModule } from '../lake/lake.module.js';

@Module({
  imports: [LakeModule],
  controllers: [CopilotIaController],
  providers: [CopilotIaService],
  exports: [CopilotIaService],
})
export class CopilotIaModule {}

import { Module } from '@nestjs/common';
import { UsoAdminController, UsoController } from './uso.controller.js';
import { UsoService } from './uso.service.js';

@Module({
  controllers: [UsoController, UsoAdminController],
  providers: [UsoService],
})
export class UsoModule {}

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { LakeService } from './lake.service.js';
import { LakeController } from './lake.controller.js';

@Module({
  imports: [DatabaseModule],
  controllers: [LakeController],
  providers: [LakeService],
  exports: [LakeService],
})
export class LakeModule {}

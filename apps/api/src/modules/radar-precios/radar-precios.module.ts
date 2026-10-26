import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { LakeModule } from '../lake/lake.module.js';
import { RadarPreciosService } from './radar-precios.service.js';
import { RadarPreciosController } from './radar-precios.controller.js';

@Module({
  imports: [DatabaseModule, LakeModule],
  controllers: [RadarPreciosController],
  providers: [RadarPreciosService],
  exports: [RadarPreciosService],
})
export class RadarPreciosModule {}

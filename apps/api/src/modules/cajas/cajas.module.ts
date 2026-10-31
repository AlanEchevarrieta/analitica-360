import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { CajasController } from './cajas.controller.js';
import { CajasService } from './cajas.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [CajasController],
  providers: [CajasService],
  exports: [CajasService],
})
export class CajasModule {}

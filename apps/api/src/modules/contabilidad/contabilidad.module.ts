import { Module } from '@nestjs/common';
import { GastoController } from './gasto.controller.js';
import { GastoService } from './gasto.service.js';
import { GASTO_REPOSITORY } from './gasto.repository.js';
import { PrismaGastoRepository } from './prisma-gasto.repository.js';
import { ContabilidadController } from './contabilidad.controller.js';
import { ContabilidadService } from './contabilidad.service.js';
import { CONTABILIDAD_REPOSITORY } from './contabilidad.repository.js';
import { PrismaContabilidadRepository } from './prisma-contabilidad.repository.js';

@Module({
  controllers: [GastoController, ContabilidadController],
  providers: [
    GastoService,
    { provide: GASTO_REPOSITORY, useClass: PrismaGastoRepository },
    ContabilidadService,
    { provide: CONTABILIDAD_REPOSITORY, useClass: PrismaContabilidadRepository },
  ],
})
export class ContabilidadModule {}

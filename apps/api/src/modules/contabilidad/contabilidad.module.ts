import { Module } from '@nestjs/common';
import { GastoController } from './gasto.controller.js';
import { GastoService } from './gasto.service.js';
import { GASTO_REPOSITORY } from './gasto.repository.js';
import { PrismaGastoRepository } from './prisma-gasto.repository.js';
import { ContabilidadController } from './contabilidad.controller.js';
import { ContabilidadService } from './contabilidad.service.js';
import { CONTABILIDAD_REPOSITORY } from './contabilidad.repository.js';
import { PrismaContabilidadRepository } from './prisma-contabilidad.repository.js';
import { LibroDiarioService } from './libro-diario.service.js';
import { EstadosContablesController, LibroDiarioController, MovimientosFinancierosController } from './estados-contables.controller.js';
import { EstadosContablesService } from './estados-contables.service.js';
import { AdminMonotributoController, MonotributoController } from './monotributo.controller.js';
import { MonotributoService } from './monotributo.service.js';
import { ESTADOS_CONTABLES_REPOSITORY } from './estados-contables.repository.js';
import { PrismaEstadosContablesRepository } from './prisma-estados-contables.repository.js';

@Module({
  controllers: [GastoController, ContabilidadController, EstadosContablesController, MovimientosFinancierosController, LibroDiarioController, MonotributoController, AdminMonotributoController],
  providers: [
    LibroDiarioService,
    GastoService,
    { provide: GASTO_REPOSITORY, useClass: PrismaGastoRepository },
    ContabilidadService,
    { provide: CONTABILIDAD_REPOSITORY, useClass: PrismaContabilidadRepository },
    EstadosContablesService,
    MonotributoService,
    { provide: ESTADOS_CONTABLES_REPOSITORY, useClass: PrismaEstadosContablesRepository },
  ],
})
export class ContabilidadModule {}

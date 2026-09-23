import { Module } from '@nestjs/common';
import { ClientesModule } from '../clientes/clientes.module.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';
import { DASHBOARD_REPOSITORY } from './dashboard.repository.js';
import { PrismaDashboardRepository } from './prisma-dashboard.repository.js';
import { AnalyticsPeriodoController } from './periodo.controller.js';
import { AnalyticsPeriodoService } from './periodo.service.js';
import { ANALYTICS_PERIODO_REPOSITORY } from './periodo.repository.js';
import { PrismaAnalyticsPeriodoRepository } from './prisma-periodo.repository.js';

@Module({
  imports: [ClientesModule],
  controllers: [DashboardController, AnalyticsPeriodoController],
  providers: [
    DashboardService,
    { provide: DASHBOARD_REPOSITORY, useClass: PrismaDashboardRepository },
    AnalyticsPeriodoService,
    { provide: ANALYTICS_PERIODO_REPOSITORY, useClass: PrismaAnalyticsPeriodoRepository },
  ],
})
export class AnalyticsModule {}

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
import { InsightsCombosController } from './combos.controller.js';
import { InsightsCombosService } from './combos.service.js';
import { INSIGHTS_COMBOS_REPOSITORY } from './combos.repository.js';
import { PrismaInsightsCombosRepository } from './prisma-combos.repository.js';
import { InsightsController } from './insights.controller.js';
import { InsightsService } from './insights.service.js';
import { INSIGHTS_REPOSITORY } from './insights.repository.js';
import { PrismaInsightsRepository } from './prisma-insights.repository.js';
import { InflacionController } from './inflacion.controller.js';
import { InflacionService } from './inflacion.service.js';
import { INFLACION_REPOSITORY } from './inflacion.repository.js';
import { PrismaInflacionRepository } from './prisma-inflacion.repository.js';
import { BcraInflacionClient } from './bcra-inflacion.client.js';

@Module({
  imports: [ClientesModule],
  controllers: [DashboardController, AnalyticsPeriodoController, InsightsCombosController, InsightsController, InflacionController],
  providers: [
    DashboardService,
    { provide: DASHBOARD_REPOSITORY, useClass: PrismaDashboardRepository },
    AnalyticsPeriodoService,
    { provide: ANALYTICS_PERIODO_REPOSITORY, useClass: PrismaAnalyticsPeriodoRepository },
    InsightsCombosService,
    { provide: INSIGHTS_COMBOS_REPOSITORY, useClass: PrismaInsightsCombosRepository },
    InsightsService,
    { provide: INSIGHTS_REPOSITORY, useClass: PrismaInsightsRepository },
    InflacionService,
    { provide: INFLACION_REPOSITORY, useClass: PrismaInflacionRepository },
    BcraInflacionClient,
  ],
})
export class AnalyticsModule {}

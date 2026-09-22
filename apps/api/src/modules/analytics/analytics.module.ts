import { Module } from '@nestjs/common';
import { ClientesModule } from '../clientes/clientes.module.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';
import { DASHBOARD_REPOSITORY } from './dashboard.repository.js';
import { PrismaDashboardRepository } from './prisma-dashboard.repository.js';

@Module({
  imports: [ClientesModule],
  controllers: [DashboardController],
  providers: [
    DashboardService,
    { provide: DASHBOARD_REPOSITORY, useClass: PrismaDashboardRepository },
  ],
})
export class AnalyticsModule {}

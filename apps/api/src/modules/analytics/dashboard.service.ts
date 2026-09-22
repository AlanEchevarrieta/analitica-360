import { Inject, Injectable } from '@nestjs/common';
import { ClientesService } from '../clientes/clientes.service.js';
import {
  DASHBOARD_REPOSITORY,
  type DashboardDiaSerie,
  type DashboardInicio,
  type DashboardRepository,
  type RangoHome,
} from './dashboard.repository.js';

const CUMPLES_LIMITE = 5;

@Injectable()
export class DashboardService {
  constructor(
    @Inject(DASHBOARD_REPOSITORY) private readonly dashboardRepository: DashboardRepository,
    private readonly clientesService: ClientesService,
  ) {}

  async inicio(empresaId: string): Promise<DashboardInicio> {
    const [base, cumpleanos] = await Promise.all([
      this.dashboardRepository.inicio(empresaId),
      this.clientesService.cumpleanosProximos(empresaId, 7),
    ]);
    return {
      ...base,
      cumples: cumpleanos.slice(0, CUMPLES_LIMITE).map((c) => ({ id: c.id, nombre: c.nombre, dias: c.dias })),
    };
  }

  serieHome(empresaId: string, dias: RangoHome): Promise<DashboardDiaSerie[]> {
    return this.dashboardRepository.serieHome(empresaId, dias);
  }
}

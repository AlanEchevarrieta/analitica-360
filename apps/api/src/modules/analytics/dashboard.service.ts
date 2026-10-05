import { Inject, Injectable } from '@nestjs/common';
import { ClientesService } from '../clientes/clientes.service.js';
import { CotizacionesService, type Moneda } from '../cotizaciones/cotizaciones.service.js';
import { fechaHoyAR, sumarDiasIso } from './analytics.util.js';
import {
  DASHBOARD_REPOSITORY,
  type DashboardInicio,
  type DashboardRepository,
} from './dashboard.repository.js';

const CUMPLES_LIMITE = 5;

@Injectable()
export class DashboardService {
  constructor(
    @Inject(DASHBOARD_REPOSITORY) private readonly dashboardRepository: DashboardRepository,
    private readonly clientesService: ClientesService,
    private readonly cotizaciones: CotizacionesService,
  ) {}

  async inicio(empresaId: string, moneda?: Moneda): Promise<DashboardInicio> {
    // Lo más viejo del Inicio es el lunes de la semana o el 1 del mes: un mes y algo alcanza.
    const conv = await this.cotizaciones.conversor(empresaId, moneda, sumarDiasIso(fechaHoyAR(), -40));
    const [base, cumpleanos] = await Promise.all([
      this.dashboardRepository.inicio(empresaId, conv),
      this.clientesService.cumpleanosProximos(empresaId, 7),
    ]);
    return {
      ...base,
      cumples: cumpleanos.slice(0, CUMPLES_LIMITE).map((c) => ({ id: c.id, nombre: c.nombre, dias: c.dias })),
    };
  }

}

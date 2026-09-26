import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ADMIN_SAAS_REPOSITORY,
  type AdminCapacidad,
  type AdminPago,
  type AdminSaasMetrics,
  type AdminSaasRepository,
} from './admin-saas.repository.js';
import type { RegistrarPagoDto } from './admin-saas.dto.js';
import { PrismaAdminClientesRepository } from './prisma-admin-clientes.repository.js';
import type { AdminEmpresaDetalle, AdminEmpresaFila, AdminEvolucionMes, AdminTablaTamano } from './admin-clientes.types.js';
import { alertasEmpresa } from './admin-clientes.util.js';
import { fechaHoyAR } from '../analytics/analytics.util.js';

@Injectable()
export class AdminSaasService {
  constructor(
    @Inject(ADMIN_SAAS_REPOSITORY) private readonly repository: AdminSaasRepository,
    private readonly clientes: PrismaAdminClientesRepository,
  ) {}

  private conAlertas(filas: AdminEmpresaFila[]): AdminEmpresaFila[] {
    const hoy = fechaHoyAR();
    return filas.map((f) => ({ ...f, ...alertasEmpresa(f, hoy) }));
  }

  async empresas(): Promise<AdminEmpresaFila[]> {
    return this.conAlertas(await this.clientes.empresas());
  }

  async empresa(id: string): Promise<AdminEmpresaDetalle> {
    const [fila] = await this.clientes.empresas(id);
    const detalle = fila ? await this.clientes.detalle(id) : null;
    if (!fila || !detalle) throw new NotFoundException('Empresa no encontrada');
    return { empresa: this.conAlertas([fila])[0], ...detalle };
  }

  evolucion(): Promise<AdminEvolucionMes[]> {
    return this.clientes.evolucion();
  }

  metrics(): Promise<AdminSaasMetrics> {
    return this.repository.metrics();
  }

  async capacidad(): Promise<AdminCapacidad & { baseBytes: number; tablas: AdminTablaTamano[] }> {
    const [capacidad, base] = await Promise.all([this.repository.capacidad(), this.clientes.tamanoBase()]);
    return { ...capacidad, baseBytes: base.bytes, tablas: base.tablas };
  }

  listarPagos(estado: string, periodo: string): Promise<AdminPago[]> {
    return this.repository.listarPagos(estado || null, periodo || null);
  }

  async registrarPago(input: RegistrarPagoDto): Promise<{ id: string }> {
    const resultado = await this.repository.registrarPago({
      empresaId: input.empresaId,
      monto: input.monto,
      metodo: input.metodo,
      periodo: input.periodo,
      notas: input.notas || null,
    });
    if (!resultado.ok) {
      if (resultado.motivo === 'empresa_invalida') throw new NotFoundException('Empresa no encontrada');
      if (resultado.motivo === 'monto_invalido') throw new BadRequestException('El monto tiene que ser mayor a 0');
      throw new BadRequestException('El método de pago es obligatorio');
    }
    return { id: resultado.id };
  }
}

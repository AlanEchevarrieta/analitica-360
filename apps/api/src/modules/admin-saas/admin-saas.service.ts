import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ADMIN_SAAS_REPOSITORY,
  type AdminCapacidad,
  type AdminPago,
  type AdminSaasMetrics,
  type AdminSaasRepository,
} from './admin-saas.repository.js';
import type { RegistrarPagoDto } from './admin-saas.dto.js';

@Injectable()
export class AdminSaasService {
  constructor(@Inject(ADMIN_SAAS_REPOSITORY) private readonly repository: AdminSaasRepository) {}

  metrics(): Promise<AdminSaasMetrics> {
    return this.repository.metrics();
  }

  capacidad(): Promise<AdminCapacidad> {
    return this.repository.capacidad();
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

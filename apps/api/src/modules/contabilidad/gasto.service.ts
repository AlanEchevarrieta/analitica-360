import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { GASTO_REPOSITORY, type CategoriaGasto, type Gasto, type GastoRepository, type TipoCosto } from './gasto.repository.js';
import type { CambiarMontoGastoDto, CrearGastoDto, EditarGastoDto } from './gasto.dto.js';
import { sumarDiasISO } from './contabilidad.util.js';

@Injectable()
export class GastoService {
  constructor(@Inject(GASTO_REPOSITORY) private readonly repository: GastoRepository) {}

  listar(empresaId: string, desde: string, hasta: string, categoria?: CategoriaGasto): Promise<Gasto[]> {
    return this.repository.listar(empresaId, desde, hasta, categoria);
  }

  crear(empresaId: string, usuarioId: string, input: CrearGastoDto): Promise<Gasto> {
    return this.repository.crear({ empresaId, usuarioId, ...input });
  }

  async editar(empresaId: string, id: string, input: EditarGastoDto): Promise<Gasto> {
    const gasto = await this.repository.editar(empresaId, id, input);
    if (!gasto) throw new NotFoundException('Gasto no encontrado');
    return gasto;
  }

  async dejarDeRepetir(empresaId: string, id: string, desde: string): Promise<Gasto> {
    const fechaFin = sumarDiasISO(desde, -1);
    const gasto = await this.repository.dejarDeRepetir(empresaId, id, fechaFin);
    if (!gasto) throw new NotFoundException('Gasto no encontrado');
    return gasto;
  }

  async cambiarMontoDesde(empresaId: string, usuarioId: string, id: string, body: CambiarMontoGastoDto): Promise<Gasto> {
    const fechaFinViejo = sumarDiasISO(body.desde, -1);
    const nuevo = await this.repository.cambiarMontoDesde(empresaId, usuarioId, id, body.desde, fechaFinViejo, body.monto);
    if (!nuevo) throw new NotFoundException('Gasto no encontrado');
    return nuevo;
  }

  async cambiarTipoCosto(empresaId: string, id: string, tipoCosto: TipoCosto): Promise<void> {
    if (!(await this.repository.cambiarTipoCosto(empresaId, id, tipoCosto))) throw new NotFoundException('Gasto no encontrado');
  }

  async anular(empresaId: string, id: string): Promise<void> {
    const resultado = await this.repository.anular(empresaId, id);
    if (!resultado.ok && resultado.motivo === 'no_encontrado') {
      throw new NotFoundException('Gasto no encontrado');
    }
    // 'ya_anulado' es idempotente: no es un error para quien lo pide.
  }
}

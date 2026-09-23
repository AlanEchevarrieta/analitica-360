import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { GASTO_REPOSITORY, type CategoriaGasto, type Gasto, type GastoRepository } from './gasto.repository.js';
import type { CrearGastoDto } from './gasto.dto.js';

@Injectable()
export class GastoService {
  constructor(@Inject(GASTO_REPOSITORY) private readonly repository: GastoRepository) {}

  listar(empresaId: string, desde: string, hasta: string, categoria?: CategoriaGasto): Promise<Gasto[]> {
    return this.repository.listar(empresaId, desde, hasta, categoria);
  }

  crear(empresaId: string, usuarioId: string, input: CrearGastoDto): Promise<Gasto> {
    return this.repository.crear({ empresaId, usuarioId, ...input });
  }

  async anular(empresaId: string, id: string): Promise<void> {
    const resultado = await this.repository.anular(empresaId, id);
    if (!resultado.ok && resultado.motivo === 'no_encontrado') {
      throw new NotFoundException('Gasto no encontrado');
    }
    // 'ya_anulado' es idempotente: no es un error para quien lo pide.
  }
}

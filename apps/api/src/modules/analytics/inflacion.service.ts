import { Inject, Injectable } from '@nestjs/common';
import { BcraInflacionClient } from './bcra-inflacion.client.js';
import { INFLACION_REPOSITORY, type InflacionRepository } from './inflacion.repository.js';
import { armarSerieInflacion, INFLACION_INDEC, mesesEnRango, SERIE_INFLACION_VACIA, type SerieInflacionPrecios } from './inflacion.util.js';

const MSG_SIN_INFLACION = 'Datos de inflación no disponibles para este período';

@Injectable()
export class InflacionService {
  constructor(
    @Inject(INFLACION_REPOSITORY) private readonly repository: InflacionRepository,
    private readonly bcra: BcraInflacionClient,
  ) {}

  /** Puerto de mapaInflacionParaPeriodo: tabla estática primero, BCRA (con el desde/hasta original, no truncado a mes) solo para los meses que faltan. */
  private async mapaInflacionParaPeriodo(desde: string, hasta: string, meses: string[]): Promise<{ mapa: Record<string, number>; errorInflacion: string | null }> {
    const mapa: Record<string, number> = {};
    for (const mes of meses) if (INFLACION_INDEC[mes] != null) mapa[mes] = INFLACION_INDEC[mes];
    const faltan = meses.filter((m) => mapa[m] == null);
    if (faltan.length > 0) {
      const extra = await this.bcra.inflacionDesdeBcra(desde, hasta);
      if (extra) for (const mes of faltan) if (extra[mes] != null) mapa[mes] = extra[mes];
    }
    const hay = meses.some((m) => mapa[m] != null);
    return { mapa, errorInflacion: hay ? null : MSG_SIN_INFLACION };
  }

  async inflacionVsPrecios(empresaId: string, desde: string, hasta: string): Promise<SerieInflacionPrecios> {
    const meses = mesesEnRango(desde, hasta);
    const { mapa: inflacion, errorInflacion } = await this.mapaInflacionParaPeriodo(desde, hasta, meses);
    if (errorInflacion) return { ...SERIE_INFLACION_VACIA, errorInflacion, desde, hasta };

    // Fuente principal: los precios reales a los que se vendió (el historial
    // de precios es escaso y mezcla cambios de costo); si no hubo ventas, el historial.
    let precios = new Map<string, number>();
    try {
      precios = await this.repository.preciosPromedioVentasItems(empresaId, desde, hasta);
    } catch {
      precios = new Map();
    }
    if (precios.size === 0) {
      try {
        precios = await this.repository.preciosPromedioHistorial(empresaId, desde, hasta);
      } catch {
        precios = new Map();
      }
    }

    return armarSerieInflacion(meses, inflacion, precios, desde, hasta);
  }
}

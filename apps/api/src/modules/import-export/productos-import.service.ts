import { Inject, Injectable } from '@nestjs/common';
import { PRODUCTOS_IMPORT_REPOSITORY, type ProductosImportRepository } from './productos-import.repository.js';
import { claveNombre } from './excel.util.js';
import { filasDesdeMatriz, partirEnLotes } from './productos-import.util.js';

export interface ResultadoImportacionProductos {
  importados: number;
  saltados: string[];
}

@Injectable()
export class ProductosImportService {
  constructor(@Inject(PRODUCTOS_IMPORT_REPOSITORY) private readonly repository: ProductosImportRepository) {}

  async importar(empresaId: string, usuarioId: string, matriz: unknown[][]): Promise<ResultadoImportacionProductos> {
    const filas = filasDesdeMatriz(matriz);
    const existentes = await this.repository.nombresExistentes(empresaId);

    const vistos = new Set(existentes.map(claveNombre));
    const saltados: string[] = [];
    const pendientes: typeof filas = [];
    for (const fila of filas) {
      const clave = claveNombre(fila.nombre);
      if (vistos.has(clave)) {
        saltados.push(fila.nombre);
        continue;
      }
      vistos.add(clave);
      pendientes.push(fila);
    }

    let importados = 0;
    for (const lote of partirEnLotes(pendientes)) {
      const resultados = await Promise.allSettled(lote.map((fila) => this.repository.crear(empresaId, usuarioId, fila)));
      resultados.forEach((r, i) => {
        const fila = lote[i];
        if (r.status === 'fulfilled' && r.value.ok) {
          importados += 1;
          return;
        }
        const motivo = r.status === 'fulfilled' ? r.value.motivo : r.reason instanceof Error ? r.reason.message : String(r.reason);
        saltados.push(`${fila.nombre} (${motivo})`);
      });
    }

    return { importados, saltados };
  }
}

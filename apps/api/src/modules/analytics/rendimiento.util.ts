/** Quién y dónde se vende más: participación, ticket promedio y variación vs. el período anterior. */

export interface FilaVentas {
  clave: string;
  nombre: string;
  ventas: number;
  total: number;
}

export interface FilaRendimiento extends FilaVentas {
  /** % del total vendido en el período. */
  pct: number;
  ticket: number;
  totalAnterior: number;
  /** % de cambio del total vs. el período anterior (null si antes no vendió). */
  variacion: number | null;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Período anterior de la misma duración, justo antes de `desde`. */
export function periodoAnterior(desde: string, hasta: string): { desde: string; hasta: string } {
  const d = Date.parse(`${desde}T00:00:00Z`);
  const h = Date.parse(`${hasta}T00:00:00Z`);
  const dias = Math.round((h - d) / 86_400_000) + 1;
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  return { desde: iso(d - dias * 86_400_000), hasta: iso(d - 86_400_000) };
}

export function rendimiento(actual: FilaVentas[], anterior: FilaVentas[]): FilaRendimiento[] {
  const total = actual.reduce((a, f) => a + f.total, 0);
  const antes = new Map(anterior.map((f) => [f.clave, f.total]));
  return actual
    .map((f) => {
      const totalAnterior = antes.get(f.clave) ?? 0;
      return {
        ...f,
        pct: total > 0 ? r1((f.total / total) * 100) : 0,
        // Con centavos: en dólares un ticket de US$ 46,73 no se puede redondear a 47.
        ticket: f.ventas > 0 ? Math.round((f.total / f.ventas) * 100) / 100 : 0,
        totalAnterior,
        variacion: totalAnterior > 0 ? r1(((f.total - totalAnterior) / totalAnterior) * 100) : null,
      };
    })
    .sort((a, b) => b.total - a.total);
}

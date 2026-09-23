export interface InsightCombo2 {
  productoAId: string;
  productoBId: string;
  nombreA: string;
  nombreB: string;
  vecesJuntos: number;
  totalVentas: number;
  soporte: number;
  confianzaA: number;
  confianzaB: number;
  lift: number | null;
}

export interface InsightCombo3 {
  nombreA: string;
  nombreB: string;
  nombreC: string;
  vecesJuntos: number;
  soporte: number;
  lift: number | null;
}

export const INSIGHTS_COMBOS_REPOSITORY = Symbol('INSIGHTS_COMBOS_REPOSITORY');

/**
 * Puerto fiel de insights_combos() / insights_combos_3() (market basket
 * analysis: soporte/confianza/lift) - src/lib/insights.ts::cargarInsightsCombos(3).
 * SQL real en supabase/048_insights_combos.sql y supabase/049_combos_3.sql,
 * sin redefiniciones posteriores.
 */
export interface InsightsCombosRepository {
  /** Pares de productos vendidos juntos (ventas con >1 ítem, mínimo 3 co-ocurrencias). */
  combos(empresaId: string, limite: number): Promise<InsightCombo2[]>;
  /** Tríos de productos vendidos juntos (ventas con >=3 ítems, mínimo 2 co-ocurrencias). */
  combos3(empresaId: string, limite: number): Promise<InsightCombo3[]>;
}

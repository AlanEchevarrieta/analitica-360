// Espejos de las respuestas de apps/api (analytics/periodo, contabilidad, insights, inflación).

export interface Periodo {
  total: number;
  cantidad: number;
  costo: number;
  porCobrar: number;
  evolucion: { fecha: string; total: number; anterior: number; cantidad: number }[];
  formasPago: { nombre: string; total: number; cantidad: number }[];
  top10: { nombre: string; unidades: number }[];
  devoluciones: { ingreso: number; costo: number };
}

export type Semaforo = "verde" | "amarillo" | "rojo";

export interface PuntoMes {
  clave: string;
  ingresos: number;
  cogs: number;
  gastos: number;
  resultado: number;
  acumulado?: number;
}

export interface Contabilidad {
  totales: { ingresos: number; cogs: number; gastos: number; neto: number; cantidadVentas: number };
  serie6: PuntoMes[];
  valorStock: { invertido: number; valorVenta: number; gananciaPotencial: number };
  ratios: { margenBrutoPct: number; margenNetoPct: number; puntoEquilibrio: number; roiPct: number; diasInventario: number; ticket: number; neto: number };
  semaforoMargenBruto: Semaforo;
  semaforoMargenNeto: Semaforo;
  proyeccion: PuntoMes[];
  flujoProyectado: PuntoMes[];
}

export interface Gasto {
  id: string;
  categoria: string;
  descripcion: string;
  monto: number;
  fecha: string;
  recurrente: boolean;
  frecuencia: "mensual" | "quincenal" | "semanal" | null;
}

export interface Insights {
  salud: { ejes: { eje: string; valor: number }[]; score: number; etiqueta: string; bullets: string[] } | null;
  elasticidades: {
    productoId: string;
    producto: string;
    precioAnterior: number;
    precioActual: number;
    deltaPrecioPct: number;
    deltaVentasPct: number;
    elasticidad: number;
    badge: "inelastica" | "moderada" | "elastica" | "otros_factores";
    recomendacion: string;
  }[];
  forecast: {
    puntos: { clave: string; historico: number | null; proyeccion: number | null }[];
    totalProyeccion: number;
    tendencia: "positiva" | "negativa" | "neutra";
    etiquetaProyeccion: string;
  } | null;
  variantes: {
    hayVentas: boolean;
    porAtributo: { atributo: string; valores: { name: string; unidades: number; pct: number }[] }[];
    bullets: string[];
  } | null;
  precios: { producto: string; precioActual: number; precioSugerido: number; extraMes: number }[];
  errores: Record<string, string | undefined>;
}

export interface Combo {
  nombreA: string;
  nombreB: string;
  vecesJuntos: number;
  soporte: number;
  confianzaA: number;
  confianzaB: number;
  lift: number;
}

export interface Inflacion {
  puntos: { mesKey: string; inflacion: number | null; variacion: number | null; diferencia: number | null }[];
  hayPrecios: boolean;
  resumen: { inflacionAcumuladaPct: number | null; variacionPreciosPct: number | null; diferenciaPct: number | null; valorRealDe100: number | null };
  errorInflacion: string | null;
}

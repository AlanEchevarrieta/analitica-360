// Espejos de las respuestas de apps/api (analytics/periodo, contabilidad, insights, inflación).

export interface Periodo {
  total: number;
  cantidad: number;
  costo: number;
  porCobrar: number;
  evolucion: { fecha: string; total: number; anterior: number; cantidad: number }[];
  evolucionDiaria: { fecha: string; total: number }[];
  /** 0 = domingo … 6 = sábado. */
  diasSemana: { dia: number; total: number; cantidad: number }[];
  /** 0 a 23, hora de Argentina. */
  horas: { hora: number; total: number; cantidad: number }[];
  ventasSinHora: number;
  comprasDiarias: { fecha: string; total: number }[];
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
  /** Solo en los combos de 3. */
  nombreC?: string;
  vecesJuntos: number;
  soporte: number;
  /** Solo en los pares. */
  confianzaA?: number;
  confianzaB?: number;
  lift: number | null;
}

export interface Inflacion {
  puntos: { mesKey: string; inflacion: number | null; variacion: number | null; diferencia: number | null }[];
  hayPrecios: boolean;
  resumen: { inflacionAcumuladaPct: number | null; variacionPreciosPct: number | null; diferenciaPct: number | null; valorRealDe100: number | null };
  errorInflacion: string | null;
}

// Espejo de EstadosContablesRespuesta (apps/api modules/contabilidad/estados-contables.service.ts).
export interface Balance {
  fecha: string;
  activo: {
    caja: number;
    cajaEstimada: boolean;
    creditosPorVentas: number;
    bienesDeCambio: number;
    corriente: number;
    bienesDeUsoOrigen: number;
    amortizacionAcumulada: number;
    bienesDeUso: number;
    noCorriente: number;
    total: number;
  };
  pasivo: { deudasComerciales: number; prestamos: number; total: number };
  patrimonioNeto: { aportes: number; retiros: number; resultadosAcumulados: number; capitalInicialYAjustes: number; total: number };
}

export type ConceptoCaja =
  | "cobros_ventas"
  | "devoluciones"
  | "pagos_compras"
  | "pagos_proveedores"
  | "gastos"
  | "bienes_uso"
  | "aportes"
  | "retiros"
  | "prestamos_recibidos"
  | "prestamos_pagados";

export interface EstadosContables {
  desde: string;
  hasta: string;
  resultados: {
    ventasBrutas: number;
    devoluciones: number;
    ventasNetas: number;
    costoMercaderia: number;
    resultadoBruto: number;
    gastosPorCategoria: { categoria: string; monto: number }[];
    gastosTotal: number;
    /** Mermas, roturas, pérdidas y consumo interno, a costo. */
    perdidasMercaderia: number;
    amortizaciones: number;
    resultadoNeto: number;
    cantidadVentas: number;
  };
  balanceInicio: Balance;
  balanceCierre: Balance;
  evolucion: { inicio: number; aportes: number; retiros: number; resultado: number; ajustes: number; cierre: number };
  flujo: {
    saldoInicial: number;
    lineas: { concepto: ConceptoCaja; actividad: "operativa" | "inversion" | "financiacion"; monto: number }[];
    operativas: number;
    inversion: number;
    financiacion: number;
    diferenciasArqueo: number;
    saldoFinal: number;
  };
  indicadores: {
    liquidez: number | null;
    pruebaAcida: number | null;
    solvencia: number | null;
    endeudamiento: number | null;
    rentabilidadPatrimonioPct: number | null;
  };
  deudaPorProveedor: { proveedorId: string | null; nombre: string; comprado: number; pagado: number; saldo: number }[];
  notas: { criterios: string[]; avisos: string[] };
}

export type TipoMovimientoFinanciero = "arqueo" | "aporte" | "retiro" | "prestamo_recibido" | "prestamo_pago" | "bien_uso" | "pago_proveedor";

export interface MovimientoFinanciero {
  id: string;
  tipo: TipoMovimientoFinanciero;
  monto: number;
  fecha: string;
  descripcion: string;
  proveedorId: string | null;
  proveedorNombre: string | null;
  vidaUtilMeses: number | null;
  conCaja: boolean;
}

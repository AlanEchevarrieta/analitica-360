import * as ss from 'simple-statistics';
import { inicioAnioIso, inicioMesIso, lunesIso, sumarDiasIso } from './analytics.util.js';

/**
 * Puerto fiel de src/lib/insights.ts - a diferencia de dashboard_inicio() y
 * analytics_periodo(), esta parte del legacy NO está detrás de RPCs de
 * Postgres: son ~5 algoritmos en JS puro (score de salud, elasticidad de
 * precios, forecast con regresión lineal, precios óptimos sugeridos,
 * distribución de variantes) que corren sobre datos ya cargados. Se portan
 * literalmente acá, alimentados por consultas propias en
 * PrismaInsightsRepository en vez de las funciones RPC/paginación de
 * Supabase del legacy.
 *
 * Las etiquetas de fecha con formato es-AR para gráficos (etiquetaDia,
 * etiquetaMes, etiquetaAnio del legacy) son presentación, no lógica de
 * negocio - igual que en analytics_periodo, se devuelve la clave ISO cruda y
 * el formateo queda para el frontend Next.js. En cambio los bullets,
 * badges y recomendaciones en español SÍ se preservan: son el resultado
 * mismo de la feature (un "insight" es un mensaje), no formato de UI.
 */

export interface InsightProducto {
  id: string;
  nombre: string;
  costo: number;
  precioVenta: number;
  activo: boolean;
  stockActual: number;
}

export interface VentaInsight {
  id: string;
  fechaIso: string;
  clienteId: string | null;
  total: number;
}

export interface ItemInsight {
  ventaId: string;
  productoId: string;
  varianteId: string | null;
  cantidad: number;
}

export interface HistorialPrecio {
  productoId: string;
  precio: number;
  desde: string;
}

export interface VarianteInsight {
  id: string;
  productoId: string;
  atributos: Record<string, string>;
}

export interface InsightRadarEje {
  eje: string;
  valor: number;
  fullMark: number;
}

export interface InsightSalud {
  ejes: InsightRadarEje[];
  score: number;
  etiqueta: string;
  color: string;
  bullets: string[];
}

export type BadgeElasticidad = 'inelastica' | 'moderada' | 'elastica' | 'giffen';

export interface FilaElasticidad {
  productoId: string;
  producto: string;
  precioAnterior: number;
  precioActual: number;
  deltaPrecioPct: number;
  deltaVentasPct: number;
  elasticidad: number;
  badge: BadgeElasticidad;
  recomendacion: string;
}

export type GranularidadForecast = 'dia' | 'semana' | 'mes' | 'anio';

export interface PuntoSerieDia {
  fecha: string;
  total: number;
}

export interface PuntoForecast {
  clave: string;
  historico: number | null;
  proyeccion: number | null;
}

export interface InsightForecast {
  diasHistorial: number;
  periodosHistorial: number;
  puntos: PuntoForecast[];
  totalProyeccion: number;
  tendencia: 'positiva' | 'negativa' | 'neutra';
  granularidad: GranularidadForecast;
  etiquetaProyeccion: string;
}

export interface DistAtributo {
  atributo: string;
  valores: { name: string; pct: number; unidades: number }[];
}

export interface ComboVariante {
  id: string;
  etiqueta: string;
  unidades: number;
  pct: number;
  tendencia: 'up' | 'down' | 'flat';
}

export interface InsightVariantes {
  hayVentas: boolean;
  porAtributo: DistAtributo[];
  combinaciones: ComboVariante[];
  bullets: string[];
}

export interface FilaPrecioOptimo {
  producto: string;
  precioActual: number;
  precioSugerido: number;
  extraMes: number;
}

export interface InsightsErrores {
  radar?: string;
  elasticidad?: string;
  forecast?: string;
  variantes?: string;
  precio?: string;
}

export interface InsightsPayload {
  salud: InsightSalud | null;
  elasticidades: FilaElasticidad[];
  forecast: InsightForecast | null;
  serieDiaria: PuntoSerieDia[];
  diasHistorial: number;
  variantes: InsightVariantes | null;
  precios: FilaPrecioOptimo[];
  errores: InsightsErrores;
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, n));
}

/** Puerto de mesAnteriorDe (src/lib/insights.ts). */
export function mesAnteriorDe(isoMes: string): string {
  const [y, m] = isoMes.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 2, 1));
  return dt.toISOString().slice(0, 10);
}

/** Puerto de inicioMesHace (src/lib/insights.ts). */
export function inicioMesHace(iso: string, mesesAtras: number): string {
  const [y, m] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 - mesesAtras, 1));
  return dt.toISOString().slice(0, 10);
}

function interpretarElasticidad(e: number): Pick<FilaElasticidad, 'badge' | 'recomendacion'> {
  if (e > 0) return { badge: 'giffen', recomendacion: 'Más precio = más ventas' };
  if (e >= -0.5) return { badge: 'inelastica', recomendacion: 'Podés subir precio sin perder ventas' };
  if (e >= -1) return { badge: 'moderada', recomendacion: 'Subí precio con cuidado' };
  return { badge: 'elastica', recomendacion: 'Muy sensible al precio' };
}

function ejePrecio(filas: FilaElasticidad[]): number {
  let extra = 0;
  for (const f of filas) {
    if (f.badge === 'inelastica') extra += 15;
    else if (f.badge === 'moderada') extra += 8;
    else if (f.badge === 'giffen') extra += 10;
  }
  return clamp(50 + extra);
}

function bulletsSalud(ejes: Record<string, number>, score: number): string[] {
  const v = ejes.Ventas ?? 0;
  const m = ejes.Margen ?? 0;
  const s = ejes.Stock ?? 0;
  const c = ejes.Clientes ?? 0;
  const out: string[] = [];
  if (v > 70) out.push('📈 Las ventas van en alza');
  if (v < 40) out.push('📉 Las ventas bajaron — revisá precios y stock');
  if (m > 70) out.push('✅ Tu margen es excelente');
  if (m < 40) out.push('⚠️ Margen bajo — revisá tus costos');
  if (s < 40) out.push('📦 Más del 60% de tus productos sin stock');
  if (c < 30) out.push('👥 Pocos clientes identificados — usá el CRM');
  if (score > 80) out.push('🏆 Tu negocio está en excelente forma');
  return out.slice(0, 4);
}

function semaforo(score: number): { etiqueta: string; color: string } {
  if (score >= 80) return { etiqueta: 'Negocio saludable 🟢', color: '#4ADE80' };
  if (score >= 60) return { etiqueta: 'Atención recomendada 🟡', color: '#FCD34D' };
  return { etiqueta: 'Requiere acción 🔴', color: '#F87171' };
}

/** Puerto de calcularSalud (src/lib/insights.ts). */
export function calcularSalud(input: {
  ventasMes: number;
  ventasMesAnt: number;
  hayMesAnterior: boolean;
  productos: InsightProducto[];
  ventas: VentaInsight[];
  elasticidades: FilaElasticidad[];
}): InsightSalud {
  let ventasEje = 50;
  if (input.hayMesAnterior) {
    if (input.ventasMesAnt <= 0) ventasEje = input.ventasMes > 0 ? 100 : 50;
    else ventasEje = clamp((input.ventasMes / input.ventasMesAnt) * 50);
  }

  const conCosto = input.productos.filter((p) => p.costo > 0 && p.precioVenta > 0);
  let margenEje = 50;
  if (conCosto.length > 0) {
    const avg = conCosto.reduce((acc, p) => acc + ((p.precioVenta - p.costo) / p.precioVenta) * 100, 0) / conCosto.length;
    if (avg > 40) margenEje = 100;
    else if (avg >= 20) margenEje = 60;
    else margenEje = 20;
  }

  const activos = input.productos.filter((p) => p.activo);
  const totalActivos = activos.length;
  const conStock = activos.filter((p) => p.stockActual > 0).length;
  const stockEje = totalActivos === 0 ? 0 : clamp((conStock / totalActivos) * 100);

  const totalV = input.ventas.length;
  const clientesEje = totalV === 0 ? 50 : clamp((input.ventas.filter((v) => v.clienteId).length / totalV) * 100);

  const precioEje = ejePrecio(input.elasticidades);

  const ejesMap = { Ventas: ventasEje, Margen: margenEje, Stock: stockEje, Clientes: clientesEje, Precio: precioEje };
  const score = ventasEje * 0.25 + margenEje * 0.25 + stockEje * 0.2 + clientesEje * 0.15 + precioEje * 0.15;
  const s = semaforo(score);
  return {
    ejes: (['Ventas', 'Margen', 'Stock', 'Clientes', 'Precio'] as const).map((eje) => ({
      eje,
      valor: Math.round(ejesMap[eje]),
      fullMark: 100,
    })),
    score: Math.round(score),
    etiqueta: s.etiqueta,
    color: s.color,
    bullets: bulletsSalud(ejesMap, score),
  };
}

/** Puerto de calcularElasticidades (src/lib/insights.ts). */
export function calcularElasticidades(
  productos: InsightProducto[],
  historial: HistorialPrecio[],
  ventas: VentaInsight[],
  items: ItemInsight[],
  hoy: string,
): FilaElasticidad[] {
  const porProd = new Map<string, { precio: number; desde: string }[]>();
  for (const h of historial) {
    const arr = porProd.get(h.productoId) ?? [];
    arr.push({ precio: h.precio, desde: h.desde });
    porProd.set(h.productoId, arr);
  }
  const fechaPorVenta = new Map(ventas.map((v) => [v.id, v.fechaIso]));
  const unidadesPorProdFecha = new Map<string, { fecha: string; cant: number }[]>();
  for (const it of items) {
    const fecha = fechaPorVenta.get(it.ventaId);
    if (!fecha) continue;
    const arr = unidadesPorProdFecha.get(it.productoId) ?? [];
    arr.push({ fecha, cant: it.cantidad });
    unidadesPorProdFecha.set(it.productoId, arr);
  }

  const nombres = new Map(productos.map((p) => [p.id, p.nombre]));
  const out: FilaElasticidad[] = [];

  for (const [pid, hist] of porProd) {
    const uniq: { precio: number; desde: string }[] = [];
    const orden = [...hist].sort((a, b) => a.desde.localeCompare(b.desde));
    for (const h of orden) {
      const last = uniq[uniq.length - 1];
      if (!last || Math.abs(last.precio - h.precio) > 0.009) uniq.push(h);
    }
    if (uniq.length < 2) continue;
    const actual = uniq[uniq.length - 1];
    const anterior = uniq[uniq.length - 2];
    if (anterior.precio <= 0) continue;
    const split = actual.desde;
    const diasDesp = Math.max(1, Math.round((Date.parse(`${hoy}T12:00:00`) - Date.parse(`${split}T12:00:00`)) / 86_400_000) + 1);
    const desdeAnt = sumarDiasIso(split, -diasDesp);
    const hastaAnt = sumarDiasIso(split, -1);
    const movs = unidadesPorProdFecha.get(pid) ?? [];
    let q1 = 0;
    let q2 = 0;
    for (const m of movs) {
      if (m.fecha >= split && m.fecha <= hoy) q2 += m.cant;
      else if (m.fecha >= desdeAnt && m.fecha <= hastaAnt) q1 += m.cant;
    }
    if (q1 <= 0) continue;
    const dP = (actual.precio - anterior.precio) / anterior.precio;
    if (Math.abs(dP) < 0.0001) continue;
    const dQ = (q2 - q1) / q1;
    const e = dQ / dP;
    if (!Number.isFinite(e)) continue;
    const inter = interpretarElasticidad(e);
    out.push({
      productoId: pid,
      producto: nombres.get(pid) ?? 'Producto',
      precioAnterior: anterior.precio,
      precioActual: actual.precio,
      deltaPrecioPct: dP * 100,
      deltaVentasPct: dQ * 100,
      elasticidad: e,
      ...inter,
    });
  }
  return out.sort((a, b) => a.producto.localeCompare(b.producto, 'es'));
}

/** Puerto de serieDiariaDe (src/lib/insights.ts). */
export function serieDiariaDe(ventas: VentaInsight[], desde: string, hasta: string): PuntoSerieDia[] {
  const map = new Map<string, number>();
  for (const v of ventas) {
    if (v.fechaIso < desde || v.fechaIso > hasta) continue;
    map.set(v.fechaIso, (map.get(v.fechaIso) ?? 0) + v.total);
  }
  const out: PuntoSerieDia[] = [];
  for (let d = desde; d <= hasta; d = sumarDiasIso(d, 1)) {
    out.push({ fecha: d, total: map.get(d) ?? 0 });
  }
  return out;
}

function agregarPorClave(serie: PuntoSerieDia[], claveDe: (fecha: string) => string): { clave: string; total: number }[] {
  const map = new Map<string, number>();
  for (const p of serie) {
    const k = claveDe(p.fecha);
    map.set(k, (map.get(k) ?? 0) + p.total);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([clave, total]) => ({ clave, total }));
}

/** Puerto de armarForecast (src/lib/insights.ts). Síncrono acá: el `await import('simple-statistics')` del legacy era code-splitting de Vite, no aplica en el backend. */
export function armarForecast(
  serieDiaria: PuntoSerieDia[],
  granularidad: GranularidadForecast,
  diasHistorial: number,
): InsightForecast | null {
  const serie = [...serieDiaria].filter((p) => Boolean(p.fecha)).sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (serie.length === 0) return null;

  let agregados: { clave: string; total: number }[];
  if (granularidad === 'dia') agregados = serie.map((p) => ({ clave: p.fecha, total: p.total }));
  else if (granularidad === 'semana') agregados = agregarPorClave(serie, lunesIso);
  else if (granularidad === 'mes') agregados = agregarPorClave(serie, inicioMesIso);
  else agregados = agregarPorClave(serie, inicioAnioIso);

  const puntos = agregados.filter((p) => p.total != null && Number.isFinite(p.total) && p.total !== 0);

  const maxPeriodos = granularidad === 'dia' ? 30 : granularidad === 'semana' ? 13 : granularidad === 'mes' ? 6 : 8;
  const puntosReg = puntos.slice(-maxPeriodos);
  if (puntosReg.length < 2) return null;

  const pares: [number, number][] = puntosReg.map((p, i) => [i, p.total]);
  const reg = ss.linearRegression(pares);
  const linea = ss.linearRegressionLine(reg);
  if (!Number.isFinite(reg.m) || !Number.isFinite(reg.b)) return null;

  const chart: PuntoForecast[] = puntosReg.map((p, i) => ({
    clave: p.clave,
    historico: p.total,
    proyeccion: i === puntosReg.length - 1 ? p.total : null,
  }));

  const pasos = granularidad === 'dia' ? 14 : granularidad === 'semana' ? 4 : granularidad === 'mes' ? 3 : 2;
  const stepIso = (clave: string, k: number) => {
    if (granularidad === 'dia') return sumarDiasIso(clave, k);
    if (granularidad === 'semana') return sumarDiasIso(clave, 7 * k);
    if (granularidad === 'anio') {
      const y = Number(clave.slice(0, 4));
      return `${y + k}-01-01`;
    }
    const [y, m] = clave.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1 + k, 1));
    return dt.toISOString().slice(0, 10);
  };

  let totalProyeccion = 0;
  const lastClave = puntosReg[puntosReg.length - 1].clave;
  for (let k = 1; k <= pasos; k++) {
    const x = puntosReg.length - 1 + k;
    const y = Math.max(0, linea(x));
    totalProyeccion += y;
    chart.push({ clave: stepIso(lastClave, k), historico: null, proyeccion: y });
  }

  const etiquetaProyeccion =
    granularidad === 'dia'
      ? 'Proyección próximos 14 días'
      : granularidad === 'semana'
        ? 'Proyección próximas 4 semanas'
        : granularidad === 'mes'
          ? 'Proyección próximos 3 meses'
          : 'Proyección próximos 2 años';

  const tendencia: InsightForecast['tendencia'] = reg.m > 1 ? 'positiva' : reg.m < -1 ? 'negativa' : 'neutra';
  return { diasHistorial, periodosHistorial: puntosReg.length, puntos: chart, totalProyeccion, tendencia, granularidad, etiquetaProyeccion };
}

/** Puerto de preciosOptimos (src/lib/insights.ts). */
export function preciosOptimos(
  productos: InsightProducto[],
  elasticidades: FilaElasticidad[],
  items: ItemInsight[],
  ventas: VentaInsight[],
  desdeMes: string,
): FilaPrecioOptimo[] {
  const idsMes = new Set(ventas.filter((v) => v.fechaIso >= desdeMes).map((v) => v.id));
  const udsMes = new Map<string, number>();
  for (const it of items) {
    if (!idsMes.has(it.ventaId)) continue;
    udsMes.set(it.productoId, (udsMes.get(it.productoId) ?? 0) + it.cantidad);
  }
  const out: FilaPrecioOptimo[] = [];
  for (const fila of elasticidades) {
    if (fila.elasticidad >= 0) continue;
    const prod = productos.find((p) => p.id === fila.productoId);
    const costo = prod?.costo ?? 0;
    if (costo <= 0) continue;
    const denom = 1 + 1 / fila.elasticidad;
    if (denom <= 0) continue;
    const opt = costo / denom;
    if (!Number.isFinite(opt) || opt <= fila.precioActual) continue;
    const uds = udsMes.get(fila.productoId) ?? 0;
    out.push({ producto: fila.producto, precioActual: fila.precioActual, precioSugerido: opt, extraMes: (opt - fila.precioActual) * uds });
  }
  return out;
}

/** Puerto de armarVariantes (src/lib/insights.ts). */
export function armarVariantes(
  items: ItemInsight[],
  ventas: VentaInsight[],
  variantes: VarianteInsight[],
  stock: Map<string, number>,
  hoy: string,
): InsightVariantes {
  const conVar = items.filter((i) => i.varianteId);
  if (conVar.length === 0) return { hayVentas: false, porAtributo: [], combinaciones: [], bullets: [] };

  const fechaV = new Map(ventas.map((v) => [v.id, v.fechaIso]));
  const varMap = new Map(variantes.map((v) => [v.id, v]));
  const desde30 = sumarDiasIso(hoy, -29);
  const desde60 = sumarDiasIso(hoy, -59);
  const hastaPrev = sumarDiasIso(desde30, -1);

  const attrTot = new Map<string, Map<string, number>>();
  const comboUds = new Map<string, { etiqueta: string; unidades: number; rec: number; ant: number; varId: string }>();
  let totalUds = 0;

  for (const it of conVar) {
    const v = varMap.get(it.varianteId ?? '');
    if (!v) continue;
    const fecha = fechaV.get(it.ventaId) ?? hoy;
    totalUds += it.cantidad;
    for (const [k, val] of Object.entries(v.atributos)) {
      if (!k || !val) continue;
      const inner = attrTot.get(k) ?? new Map<string, number>();
      inner.set(val, (inner.get(val) ?? 0) + it.cantidad);
      attrTot.set(k, inner);
    }
    const etiqueta = etiquetaCombo(v.atributos) || 'Variante';
    const prev = comboUds.get(v.id) ?? { etiqueta, unidades: 0, rec: 0, ant: 0, varId: v.id };
    prev.unidades += it.cantidad;
    if (fecha >= desde30) prev.rec += it.cantidad;
    else if (fecha >= desde60 && fecha <= hastaPrev) prev.ant += it.cantidad;
    comboUds.set(v.id, prev);
  }

  const porAtributo: DistAtributo[] = [...attrTot.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'es'))
    .map(([atributo, vals]) => {
      const sum = [...vals.values()].reduce((a, b) => a + b, 0) || 1;
      return {
        atributo,
        valores: [...vals.entries()].map(([name, unidades]) => ({ name, unidades, pct: (unidades / sum) * 100 })).sort((a, b) => b.unidades - a.unidades),
      };
    });

  const combinaciones: ComboVariante[] = [...comboUds.values()]
    .map((c) => {
      let tendencia: ComboVariante['tendencia'] = 'flat';
      if (c.rec > c.ant * 1.05) tendencia = 'up';
      else if (c.rec < c.ant * 0.95) tendencia = 'down';
      return { id: c.varId, etiqueta: c.etiqueta, unidades: c.unidades, pct: totalUds > 0 ? (c.unidades / totalUds) * 100 : 0, tendencia };
    })
    .sort((a, b) => b.unidades - a.unidades);

  const bullets: string[] = [];
  const top = combinaciones[0];
  if (top) bullets.push(`🏆 Tu combinación más vendida es ${top.etiqueta} (${top.pct.toFixed(0)}%)`);
  const floja = [...combinaciones].reverse().find((c) => c.unidades > 0 && c.pct < 5);
  if (floja && floja !== top) bullets.push(`⚠️ ${floja.etiqueta} apenas vendió — considerá discontinuarla`);
  const vendidas = new Set([...comboUds.keys()]);
  const conStockSinVenta = variantes.find((v) => (stock.get(v.id) ?? 0) > 0 && !vendidas.has(v.id));
  if (conStockSinVenta) bullets.push(`💡 Tenés stock de ${etiquetaCombo(conStockSinVenta.atributos) || 'una variante'} pero no la vendés`);

  return { hayVentas: true, porAtributo, combinaciones: combinaciones.slice(0, 12), bullets };
}

/** Puerto de etiquetaCombo (src/lib/variantes.ts). */
export function etiquetaCombo(atributos: Record<string, string>): string {
  return Object.keys(atributos)
    .sort((a, b) => a.localeCompare(b, 'es'))
    .map((k) => atributos[k])
    .filter(Boolean)
    .join('/');
}

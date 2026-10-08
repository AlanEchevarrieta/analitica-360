import { formatoDolares, formatoNumero, formatoPesos } from "@/lib/formato";
import type { Objetivo, PeriodoObjetivo, Semaforo, TipoObjetivo } from "./hooks/use-objetivos";

export const TIPOS: { id: TipoObjetivo; nombre: string; ayuda: string; avanzado: boolean }[] = [
  { id: "facturacion", nombre: "Facturación", ayuda: "Lo cobrado en ventas del período", avanzado: false },
  { id: "ganancia", nombre: "Ganancia", ayuda: "Ventas menos el costo de lo vendido", avanzado: true },
  { id: "produccion", nombre: "Producción", ayuda: "Unidades fabricadas en el período", avanzado: true },
  { id: "despachos", nombre: "Pedidos despachados", ayuda: "Cantidad de pedidos despachados", avanzado: true },
  { id: "dias_despacho", nombre: "Días de despacho", ayuda: "Promedio de días desde que entra hasta que sale (máximo)", avanzado: true },
  { id: "a_tiempo", nombre: "Despachos a tiempo", ayuda: "% despachado antes de la fecha comprometida", avanzado: true },
  { id: "clientes_nuevos", nombre: "Clientes nuevos", ayuda: "Clientes que compraron por primera vez", avanzado: true },
  { id: "ticket_promedio", nombre: "Ticket promedio", ayuda: "Lo cobrado dividido la cantidad de ventas", avanzado: true },
  { id: "unidades", nombre: "Unidades vendidas", ayuda: "Unidades vendidas, en total o de un producto", avanzado: true },
  { id: "cobranza", nombre: "Cobranza de cuenta corriente", ayuda: "Lo cobrado de saldos de clientes", avanzado: true },
];

export const EN_DINERO: TipoObjetivo[] = ["facturacion", "ganancia", "ticket_promedio", "cobranza"];
export const CON_PRODUCTO: TipoObjetivo[] = ["produccion", "unidades"];
export const ACUMULATIVOS: TipoObjetivo[] = ["facturacion", "ganancia", "produccion", "despachos", "clientes_nuevos", "unidades", "cobranza"];

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** Comienzo del período que contiene a `dia` (igual que la API: la semana arranca el lunes). */
export function inicioPeriodo(periodo: PeriodoObjetivo, dia: string): string {
  const d = new Date(`${dia}T12:00:00Z`);
  if (periodo === "semana") {
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return iso(d);
  }
  const [a, m] = dia.split("-").map(Number);
  if (periodo === "mes") return `${a}-${pad(m)}-01`;
  if (periodo === "trimestre") return `${a}-${pad(Math.floor((m - 1) / 3) * 3 + 1)}-01`;
  return `${a}-01-01`;
}

/** El período actual y los próximos `n - 1` (comienzos). */
export function proximosPeriodos(periodo: PeriodoObjetivo, hoy: string, n: number): string[] {
  const out = [inicioPeriodo(periodo, hoy)];
  while (out.length < n) {
    const d = new Date(`${out[out.length - 1]}T12:00:00Z`);
    if (periodo === "semana") d.setUTCDate(d.getUTCDate() + 7);
    else if (periodo === "mes") d.setUTCMonth(d.getUTCMonth() + 1);
    else if (periodo === "trimestre") d.setUTCMonth(d.getUTCMonth() + 3);
    else d.setUTCFullYear(d.getUTCFullYear() + 1);
    out.push(iso(d));
  }
  return out;
}

const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "octubre 2026", "semana del 5/10", "4.º trimestre 2026", "2027". */
export function nombrePeriodo(periodo: PeriodoObjetivo, desde: string): string {
  const [a, m, d] = desde.split("-").map(Number);
  if (periodo === "mes") return `${MESES_LARGOS[m - 1]} ${a}`;
  if (periodo === "semana") return `semana del ${d}/${m}`;
  if (periodo === "trimestre") return `${Math.floor((m - 1) / 3) + 1}.º trimestre ${a}`;
  return String(a);
}

export const PERIODOS: { id: PeriodoObjetivo; nombre: string; adjetivo: string }[] = [
  { id: "semana", nombre: "Semana", adjetivo: "semanal" },
  { id: "mes", nombre: "Mes", adjetivo: "mensual" },
  { id: "trimestre", nombre: "Trimestre", adjetivo: "trimestral" },
  { id: "anio", nombre: "Año", adjetivo: "anual" },
];

export const nombreTipo = (t: TipoObjetivo) => TIPOS.find((x) => x.id === t)?.nombre ?? t;
export const adjetivoPeriodo = (p: PeriodoObjetivo) => PERIODOS.find((x) => x.id === p)?.adjetivo ?? p;

/** Cómo se muestra un valor de este objetivo. */
export function formatoValor(o: Pick<Objetivo, "tipo" | "moneda">, v: number | null | undefined): string {
  if (v == null) return "—";
  if (EN_DINERO.includes(o.tipo)) return o.moneda === "USD" ? formatoDolares(v) : formatoPesos(v);
  if (o.tipo === "dias_despacho") return `${v.toLocaleString("es-AR", { maximumFractionDigits: 1 })} días`;
  if (o.tipo === "a_tiempo") return `${v.toLocaleString("es-AR", { maximumFractionDigits: 1 })} %`;
  if (o.tipo === "produccion" || o.tipo === "unidades") return `${formatoNumero(v)} u.`;
  return formatoNumero(v);
}

export function alcance(o: Pick<Objetivo, "ubicacion" | "usuario" | "producto">): string {
  const partes = [o.usuario?.nombre ?? o.ubicacion ?? "Toda la empresa"];
  if (o.producto) partes.push(o.producto.nombre);
  return partes.join(" · ");
}

export const SEMAFORO: Record<Semaforo, { texto: string; barra: string; chip: string }> = {
  bien: { texto: "En camino", barra: "bg-emerald-500", chip: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  justo: { texto: "Va justo", barra: "bg-amber-500", chip: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  mal: { texto: "No llega", barra: "bg-red-500", chip: "bg-red-500/15 text-red-600 dark:text-red-400" },
  sin_datos: { texto: "Sin datos", barra: "bg-muted-foreground/30", chip: "bg-muted text-muted-foreground" },
};

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Etiqueta corta de un período: "oct", "S 6/10", "T4 2026", "2026". */
export function etiquetaPeriodo(periodo: PeriodoObjetivo, desde: string): string {
  const [a, m, d] = desde.split("-").map(Number);
  if (periodo === "mes") return MESES[m - 1];
  if (periodo === "semana") return `${d}/${m}`;
  if (periodo === "trimestre") return `T${Math.floor((m - 1) / 3) + 1} ${String(a).slice(2)}`;
  return String(a);
}

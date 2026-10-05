import { monedaActual } from "./moneda";

const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const numero = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
const fechaHora = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Mendoza",
});

export function formatoPesos(valor: number | null | undefined) {
  return pesos.format(Number.isFinite(valor) ? Number(valor) : 0);
}

export function formatoNumero(valor: number | null | undefined) {
  return numero.format(Number.isFinite(valor) ? Number(valor) : 0);
}

export function formatoFechaHora(iso: string | Date) {
  return fechaHora.format(new Date(iso));
}

const dolares = new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const dolaresConCentavos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** US$ 1.234 (con centavos si es menos de 100: un ticket de US$ 12,50 se ve mejor así). */
export function formatoDolares(valor: number | null | undefined) {
  const v = Number.isFinite(valor) ? Number(valor) : 0;
  return (Math.abs(v) < 100 ? dolaresConCentavos : dolares).format(v);
}

/** En la moneda elegida con el botón $ / US$ (Inicio y Analytics). */
export function formatoMoneda(valor: number | null | undefined) {
  return monedaActual() === "USD" ? formatoDolares(valor) : formatoPesos(valor);
}

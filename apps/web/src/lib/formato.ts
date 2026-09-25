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

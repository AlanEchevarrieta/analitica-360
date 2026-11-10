export function formatoARS(monto: number): string {
  const rounded = Math.round(Number.isFinite(monto) ? monto : 0);
  return `$${rounded.toLocaleString("es-AR")}`;
}

export function slugify(texto: string, id?: string): string {
  const base = texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return id ? `${base || "producto"}-${id.slice(0, 8)}` : base;
}

export const ATRIBUTOS_DEFAULT: { nombre: string; valores: string[] }[] = [
  { nombre: 'Color', valores: ['Negro', 'Blanco', 'Rojo', 'Verde', 'Azul', 'Marrón', 'Gris', 'Beige'] },
  { nombre: 'Talle', valores: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
  { nombre: 'Material', valores: ['Ecocuero', 'Cuero', 'Rafia', 'Tela', 'PVC'] },
  { nombre: 'Tamaño', valores: ['Chico', 'Mediano', 'Grande'] },
];

/** Puerto de src/lib/variantes.ts::normalizarAtributos. */
export function normalizarAtributos(attrs: Record<string, unknown> | null | undefined): Record<string, string> {
  const atributos: Record<string, string> = {};
  if (!attrs || typeof attrs !== 'object' || Array.isArray(attrs)) return atributos;
  for (const [k, v] of Object.entries(attrs)) {
    const key = k.trim();
    if (!key) continue;
    atributos[key] = String(v ?? '').trim();
  }
  return atributos;
}

/** Puerto de src/lib/variantes.ts::mismaCombinacion. */
export function mismaCombinacion(a: Record<string, string>, b: Record<string, string>): boolean {
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  if (ka.length !== kb.length) return false;
  return ka.every((k, i) => k === kb[i] && a[k] === b[k]);
}

/**
 * Puerto de src/lib/variantes.ts::costoPromedioPonderado, generalizado para
 * reusarlo con costo y precioVenta (mismo algoritmo - ver el comentario
 * sobre ProductoVariante en schema.prisma: "costo/precio de Producto =
 * promedio ponderado de las variantes activas"). Sin InventarioModule
 * todavía, `stock` llega en 0 para todos los items - el fallback a
 * promedio simple (peso total 0) ya cubre ese caso correctamente y se
 * corrige solo cuando el stock real esté disponible.
 */
export function promedioPonderado(items: { valor: number; stock: number }[]): number | null {
  const vivos = items.filter((i) => Number.isFinite(i.valor) && i.valor > 0);
  if (vivos.length === 0) return null;
  const peso = vivos.reduce((acc, i) => acc + Math.max(0, i.stock), 0);
  const bruto =
    peso > 0
      ? vivos.reduce((acc, i) => acc + i.valor * Math.max(0, i.stock), 0) / peso
      : vivos.reduce((acc, i) => acc + i.valor, 0) / vivos.length;
  return Math.round(bruto * 100) / 100;
}

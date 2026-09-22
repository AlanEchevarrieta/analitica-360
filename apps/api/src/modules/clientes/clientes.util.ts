/** Puerto de src/lib/clientes.ts::diasHastaCumple. */
export function diasHastaCumple(cumpleanosIso: string, hoy: Date): number | null {
  const raw = cumpleanosIso.slice(0, 10);
  const partes = raw.split('-').map(Number);
  const mes = partes[1];
  const dia = partes[2];
  if (!mes || !dia) return null;
  const hoy0 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  let fecha = new Date(hoy.getFullYear(), mes - 1, dia);
  let diff = Math.round((fecha.getTime() - hoy0.getTime()) / 86400000);
  if (diff < 0) {
    fecha = new Date(hoy.getFullYear() + 1, mes - 1, dia);
    diff = Math.round((fecha.getTime() - hoy0.getTime()) / 86400000);
  }
  return diff;
}

/** Puerto de src/lib/difusiones.ts::mesActualMendoza. */
export function mesActualMendoza(hoy = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Argentina/Mendoza',
    month: 'numeric',
  }).formatToParts(hoy);
  return Number(parts.find((p) => p.type === 'month')?.value ?? 0);
}

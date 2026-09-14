export function parseArs(texto: string) {
  const limpio = texto.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  const n = Number(limpio)
  return Number.isFinite(n) ? n : NaN
}

export function parsePorcentaje(texto: string) {
  const m = texto.replace(',', '.').match(/(-?\d+(?:\.\d+)?)\s*%/)
  return m ? Number(m[1]) : NaN
}

export function hoyISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

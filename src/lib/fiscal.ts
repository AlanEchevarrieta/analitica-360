import { formatoARS } from './productos'

export type PaisFiscal = 'argentina' | 'peru' | 'colombia' | 'otro'

export type ConfigFiscal = {
  pais: PaisFiscal
  moneda: string
  simboloMoneda: string
  alicuotaIva: number
  nombreIva: string
  mostrarIvaVentas: boolean
}

export const FISCAL_DEFAULT: ConfigFiscal = {
  pais: 'argentina',
  moneda: 'ARS',
  simboloMoneda: '$',
  alicuotaIva: 21,
  nombreIva: 'IVA',
  mostrarIvaVentas: false,
}

export const PAISES_FISCAL: {
  id: PaisFiscal
  bandera: string
  label: string
  preset: Omit<ConfigFiscal, 'pais' | 'mostrarIvaVentas'>
}[] = [
  {
    id: 'argentina',
    bandera: '🇦🇷',
    label: 'Argentina — IVA 21%, moneda ARS ($)',
    preset: { moneda: 'ARS', simboloMoneda: '$', alicuotaIva: 21, nombreIva: 'IVA' },
  },
  {
    id: 'peru',
    bandera: '🇵🇪',
    label: 'Perú — IGV 18%, moneda PEN (S/)',
    preset: { moneda: 'PEN', simboloMoneda: 'S/', alicuotaIva: 18, nombreIva: 'IGV' },
  },
  {
    id: 'colombia',
    bandera: '🇨🇴',
    label: 'Colombia — IVA 19%, moneda COP ($)',
    preset: { moneda: 'COP', simboloMoneda: '$', alicuotaIva: 19, nombreIva: 'IVA' },
  },
  {
    id: 'otro',
    bandera: '🌎',
    label: 'Otro — configurable manualmente',
    preset: { moneda: 'USD', simboloMoneda: 'US$', alicuotaIva: 0, nombreIva: 'IVA' },
  },
]

export function normalizarPais(raw: unknown): PaisFiscal {
  const v = String(raw ?? '')
  if (v === 'argentina' || v === 'peru' || v === 'colombia' || v === 'otro') return v
  return 'argentina'
}

export function presetDePais(pais: PaisFiscal): ConfigFiscal {
  const hit = PAISES_FISCAL.find((p) => p.id === pais) ?? PAISES_FISCAL[0]
  return { pais, mostrarIvaVentas: false, ...hit.preset }
}

export function formatoMoneda(valor: number, fiscal?: Pick<ConfigFiscal, 'moneda' | 'simboloMoneda'> | null) {
  const moneda = (fiscal?.moneda || 'ARS').toUpperCase()
  if (moneda === 'ARS' || !fiscal) return formatoARS(valor)
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: moneda,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(valor)
  } catch {
    const n = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(valor)
    return `${fiscal.simboloMoneda || '$'} ${n}`
  }
}

export function desgloseIva(totalConIva: number, alicuota: number) {
  const tasa = Number.isFinite(alicuota) && alicuota > 0 ? alicuota : 0
  if (tasa <= 0) {
    return { subtotal: totalConIva, iva: 0, total: totalConIva }
  }
  const factor = 1 + tasa / 100
  const subtotal = totalConIva / factor
  return { subtotal, iva: totalConIva - subtotal, total: totalConIva }
}

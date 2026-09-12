import type { SupabaseClient } from '@supabase/supabase-js'

export type MedioPagoId = 'efectivo' | 'transferencia' | 'debito' | 'credito' | 'mp_qr'

export type TasaCuota = {
  cuotas: number
  label: string
  tasa: number
  activo: boolean
  personalizada?: boolean
}

export type MostrarClienteVenta = 'siempre' | 'opcional' | 'no_mostrar'

export type FlujoVentas = {
  mostrarCliente: MostrarClienteVenta
  crearDesdeVenta: boolean
}

export type ConfiguracionEmpresa = {
  empresaId: string
  mediosPago: MedioPagoId[]
  tasasCuotas: TasaCuota[]
  flujoVentas: FlujoVentas
  umbralStockBajo: number
  usaVariantes: boolean
  usaLotes: boolean
}

export const MEDIOS_PAGO = [
  { id: 'efectivo' as const, ventaId: 'efectivo', label: 'Efectivo' },
  { id: 'transferencia' as const, ventaId: 'transferencia', label: 'Transferencia' },
  { id: 'debito' as const, ventaId: 'debito', label: 'Tarjeta Débito' },
  { id: 'credito' as const, ventaId: 'credito', label: 'Tarjeta Crédito' },
  { id: 'mp_qr' as const, ventaId: 'qr', label: 'Mercado Pago QR' },
]

export const MEDIOS_PAGO_DEFAULT: MedioPagoId[] = MEDIOS_PAGO.map((m) => m.id)

export const TASAS_CUOTAS_DEFAULT: TasaCuota[] = [
  { cuotas: 1, label: '1 cuota', tasa: 0, activo: true },
  { cuotas: 3, label: '3 cuotas', tasa: 0, activo: true },
  { cuotas: 6, label: '6 cuotas', tasa: 15, activo: true },
  { cuotas: 9, label: '9 cuotas', tasa: 25, activo: true },
  { cuotas: 12, label: '12 cuotas', tasa: 45, activo: true },
  { cuotas: 18, label: '18 cuotas', tasa: 70, activo: false },
  { cuotas: 24, label: '24 cuotas', tasa: 95, activo: false },
  { cuotas: 0, label: 'Plan Z', tasa: 0, activo: false },
]

const MEDIOS_VALIDOS = new Set<string>(MEDIOS_PAGO.map((m) => m.id))

export function idMedioAVenta(id: string) {
  if (id === 'mp_qr' || id === 'qr') return 'qr'
  return id
}

export function etiquetaMedioPago(id: string) {
  if (id === 'qr' || id === 'mp_qr') return 'Mercado Pago QR'
  return MEDIOS_PAGO.find((m) => m.id === id)?.label ?? id
}

function normalizarMedios(raw: unknown): MedioPagoId[] {
  if (!Array.isArray(raw)) return [...MEDIOS_PAGO_DEFAULT]
  const ids = raw
    .map((item) => (item === 'qr' ? 'mp_qr' : String(item)))
    .filter((id): id is MedioPagoId => MEDIOS_VALIDOS.has(id))
  return ids.length > 0 ? [...new Set(ids)] : [...MEDIOS_PAGO_DEFAULT]
}

function normalizarTasas(raw: unknown): TasaCuota[] {
  if (!Array.isArray(raw) || raw.length === 0) return TASAS_CUOTAS_DEFAULT.map((t) => ({ ...t }))
  return raw.map((item, i) => {
    const base = TASAS_CUOTAS_DEFAULT[i]
    const row = item as Record<string, unknown>
    const cuotas = Number(row.cuotas)
    const tasa = Number(row.tasa)
    const personalizada = Boolean(row.personalizada) || i >= TASAS_CUOTAS_DEFAULT.length
    const n = Number.isFinite(cuotas) ? cuotas : (base?.cuotas ?? 2)
    return {
      cuotas: n,
      label:
        typeof row.label === 'string' && row.label.trim()
          ? row.label
          : personalizada
            ? n === 0
              ? 'Plan Z'
              : `${n} cuotas`
            : (base?.label ?? `${n} cuotas`),
      tasa: Number.isFinite(tasa) && tasa >= 0 ? tasa : (base?.tasa ?? 0),
      activo: Boolean(row.activo),
      personalizada,
    }
  })
}

export function ordenarCuotasParaVenta(filas: TasaCuota[]) {
  return [...filas]
    .filter((t) => t.activo)
    .sort((a, b) => {
      const na = a.cuotas <= 0 ? Number.POSITIVE_INFINITY : a.cuotas
      const nb = b.cuotas <= 0 ? Number.POSITIVE_INFINITY : b.cuotas
      if (na !== nb) return na - nb
      return a.label.localeCompare(b.label, 'es')
    })
}

export function nuevaCuotaPersonalizada(): TasaCuota {
  return { cuotas: 2, label: '2 cuotas', tasa: 0, activo: true, personalizada: true }
}

export const FLUJO_VENTAS_DEFAULT: FlujoVentas = {
  mostrarCliente: 'opcional',
  crearDesdeVenta: true,
}

export const CONFIG_DEFAULT: Omit<ConfiguracionEmpresa, 'empresaId'> = {
  mediosPago: [...MEDIOS_PAGO_DEFAULT],
  tasasCuotas: TASAS_CUOTAS_DEFAULT.map((t) => ({ ...t })),
  flujoVentas: { ...FLUJO_VENTAS_DEFAULT },
  umbralStockBajo: 5,
  usaVariantes: false,
  usaLotes: false,
}

function normalizarFlujo(raw: unknown): FlujoVentas {
  const row =
    raw && typeof raw === 'object' && 'flujo_ventas' in (raw as object)
      ? ((raw as { flujo_ventas: unknown }).flujo_ventas as Record<string, unknown> | null)
      : (raw as Record<string, unknown> | null)
  if (!row || typeof row !== 'object') return { ...FLUJO_VENTAS_DEFAULT }
  const mostrar = String(row.mostrar_cliente ?? row.mostrarCliente ?? '')
  const mostrarCliente: MostrarClienteVenta =
    mostrar === 'siempre' || mostrar === 'no_mostrar' || mostrar === 'opcional'
      ? mostrar
      : mostrar === 'ocultar' || mostrar === 'no mostrar'
        ? 'no_mostrar'
        : 'opcional'
  const crearRaw = row.crear_desde_venta ?? row.crearDesdeVenta
  return {
    mostrarCliente,
    crearDesdeVenta: crearRaw === false ? false : true,
  }
}

function flujoAJson(flujo: FlujoVentas) {
  return {
    mostrar_cliente: flujo.mostrarCliente,
    crear_desde_venta: flujo.crearDesdeVenta,
  }
}

export async function obtenerConfiguracion(
  client: SupabaseClient,
  empresaId: string,
): Promise<{ config: ConfiguracionEmpresa; error: string | null }> {
  let conFlujo = await client
    .from('configuracion_empresa')
    .select('empresa_id, medios_pago, tasas_cuotas, flujo_ventas, inventario, usa_variantes, usa_lotes')
    .eq('empresa_id', empresaId)
    .maybeSingle()

  if (conFlujo.error && /usa_lotes/i.test(conFlujo.error.message)) {
    conFlujo = await client
      .from('configuracion_empresa')
      .select('empresa_id, medios_pago, tasas_cuotas, flujo_ventas, inventario, usa_variantes')
      .eq('empresa_id', empresaId)
      .maybeSingle()
  }

  const { data, error } = conFlujo.error
    ? await client
        .from('configuracion_empresa')
        .select('empresa_id, medios_pago, tasas_cuotas, flujo_ventas, inventario')
        .eq('empresa_id', empresaId)
        .maybeSingle()
    : conFlujo

  const fallback =
    error
      ? await client
          .from('configuracion_empresa')
          .select('empresa_id, medios_pago, tasas_cuotas')
          .eq('empresa_id', empresaId)
          .maybeSingle()
      : { data, error }

  const fila = fallback.data
  const err = fallback.error

  if (err) {
    return { config: { empresaId, ...CONFIG_DEFAULT }, error: err.message }
  }
  if (!fila) {
    return { config: { empresaId, ...CONFIG_DEFAULT }, error: null }
  }
  const inv = (fila as { inventario?: unknown }).inventario as Record<string, unknown> | null
  const umbralRaw = inv?.umbral_stock_bajo
  const umbral = Number(umbralRaw)
  return {
    config: {
      empresaId: String(fila.empresa_id ?? empresaId),
      mediosPago: normalizarMedios(fila.medios_pago),
      tasasCuotas: normalizarTasas(fila.tasas_cuotas),
      flujoVentas: normalizarFlujo((fila as { flujo_ventas?: unknown }).flujo_ventas),
      umbralStockBajo: Number.isFinite(umbral) && umbral >= 0 ? umbral : 5,
      usaVariantes: Boolean((fila as { usa_variantes?: unknown }).usa_variantes),
      usaLotes: Boolean((fila as { usa_lotes?: unknown }).usa_lotes),
    },
    error: null,
  }
}

export async function guardarConfiguracion(
  client: SupabaseClient,
  input: ConfiguracionEmpresa,
): Promise<string | null> {
  const { error } = await client.from('configuracion_empresa').upsert(
    {
      empresa_id: input.empresaId,
      medios_pago: input.mediosPago,
      tasas_cuotas: input.tasasCuotas,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'empresa_id' },
  )
  if (error) return error.message

  const { error: flujoError } = await client
    .from('configuracion_empresa')
    .update({
      flujo_ventas: flujoAJson(input.flujoVentas ?? FLUJO_VENTAS_DEFAULT),
      updated_at: new Date().toISOString(),
    })
    .eq('empresa_id', input.empresaId)

  if (flujoError) {
    const t = flujoError.message.toLowerCase()
    if (t.includes('flujo_ventas') || t.includes('schema cache') || t.includes('does not exist')) {
      const flujo = input.flujoVentas ?? FLUJO_VENTAS_DEFAULT
      if (
        flujo.mostrarCliente === FLUJO_VENTAS_DEFAULT.mostrarCliente &&
        flujo.crearDesdeVenta === FLUJO_VENTAS_DEFAULT.crearDesdeVenta
      ) {
        const inv = await guardarInventario(client, input)
        if (inv) return inv
        return await guardarUsaVariantes(client, input)
      }
      return 'Falta la columna de flujo de ventas. Pegá supabase/018_flujo_ventas.sql (rol postgres) y recargá.'
    }
    return flujoError.message
  }
  const inv = await guardarInventario(client, input)
  if (inv) return inv
  const vari = await guardarUsaVariantes(client, input)
  if (vari) return vari
  return guardarUsaLotes(client, input)
}

async function guardarUsaVariantes(client: SupabaseClient, input: ConfiguracionEmpresa) {
  const { error } = await client
    .from('configuracion_empresa')
    .update({
      usa_variantes: Boolean(input.usaVariantes),
      updated_at: new Date().toISOString(),
    })
    .eq('empresa_id', input.empresaId)
  if (!error) return null
  const t = error.message.toLowerCase()
  if (t.includes('usa_variantes') || t.includes('schema cache') || t.includes('does not exist')) {
    if (!input.usaVariantes) return null
    return 'Falta el módulo de variantes. Pegá TODO supabase/035_variantes.sql (rol postgres), dale Run y recargá.'
  }
  return error.message
}

async function guardarUsaLotes(client: SupabaseClient, input: ConfiguracionEmpresa) {
  const { error } = await client
    .from('configuracion_empresa')
    .update({
      usa_lotes: Boolean(input.usaLotes),
      updated_at: new Date().toISOString(),
    })
    .eq('empresa_id', input.empresaId)
  if (!error) return null
  const t = error.message.toLowerCase()
  if (t.includes('usa_lotes') || t.includes('schema cache') || t.includes('does not exist')) {
    if (!input.usaLotes) return null
    return 'Falta el módulo de lotes. Pegá TODO supabase/046_lotes.sql (rol postgres), dale Run y recargá.'
  }
  return error.message
}

async function guardarInventario(client: SupabaseClient, input: ConfiguracionEmpresa) {
  const umbral = Number.isFinite(input.umbralStockBajo) ? Math.max(0, Math.round(input.umbralStockBajo)) : 5
  const { error } = await client
    .from('configuracion_empresa')
    .update({
      inventario: { umbral_stock_bajo: umbral },
      updated_at: new Date().toISOString(),
    })
    .eq('empresa_id', input.empresaId)
  if (!error) return null
  const t = error.message.toLowerCase()
  if (t.includes('inventario') || t.includes('schema cache') || t.includes('does not exist')) {
    if (umbral === 5) return null
    return 'Falta la columna de inventario. Pegá supabase/026_inventario_alertas.sql (rol postgres) y recargá.'
  }
  return error.message
}

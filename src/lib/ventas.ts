import type { SupabaseClient } from '@supabase/supabase-js'

export type VentaFila = {
  id: string
  fecha: string
  productos: string
  total: number
  forma_pago: string
  cliente: string | null
  cuotas: number
}

export type ResumenVentasHoy = {
  cantidad: number
  total: number
}

export const FORMAS_PAGO = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'transferencia', label: 'Transferencia' },
  { id: 'debito', label: 'Débito' },
  { id: 'credito', label: 'Crédito' },
  { id: 'qr', label: 'Mercado Pago QR' },
] as const

export function etiquetaFormaPago(id: string) {
  return FORMAS_PAGO.find((f) => f.id === id)?.label ?? id
}

export async function listarVentas(
  client: SupabaseClient,
): Promise<{ filas: VentaFila[]; error: string | null }> {
  const { data, error } = await client.rpc('listar_ventas_empresa')
  if (error) return { filas: [], error: error.message }
  const filas = ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    fecha: String(row.fecha ?? ''),
    productos: String(row.productos ?? ''),
    total: Number(row.total ?? 0),
    forma_pago: String(row.forma_pago ?? ''),
    cliente: row.cliente == null || row.cliente === '' ? null : String(row.cliente),
    cuotas: Number(row.cuotas ?? 1),
  }))

  const ids = filas.map((f) => f.id)
  if (ids.length > 0) {
    const extra = await client.from('ventas').select('id, cuotas').in('id', ids)
    if (!extra.error && extra.data) {
      const mapa = new Map(extra.data.map((r) => [String(r.id), Number(r.cuotas ?? 1)]))
      for (const fila of filas) {
        const n = mapa.get(fila.id)
        if (Number.isFinite(n)) fila.cuotas = n as number
      }
    }
  }

  return { filas, error: null }
}

export async function resumenVentasHoy(
  client: SupabaseClient,
): Promise<ResumenVentasHoy> {
  const { data, error } = await client.rpc('resumen_ventas_hoy')
  if (error) return { cantidad: 0, total: 0 }
  const fila = Array.isArray(data) ? data[0] : data
  return {
    cantidad: Number(fila?.cantidad ?? 0),
    total: Number(fila?.total ?? 0),
  }
}

export const OPCIONES_CUOTAS = [
  { id: '1', cuotas: 1, label: '1 cuota (contado)', coefDefault: 0 },
  { id: '3', cuotas: 3, label: '3 cuotas', coefDefault: 0 },
  { id: '6', cuotas: 6, label: '6 cuotas', coefDefault: 15 },
  { id: '9', cuotas: 9, label: '9 cuotas', coefDefault: 25 },
  { id: '12', cuotas: 12, label: '12 cuotas', coefDefault: 45 },
  { id: '18', cuotas: 18, label: '18 cuotas', coefDefault: 70 },
  { id: '24', cuotas: 24, label: '24 cuotas', coefDefault: 95 },
  { id: 'z', cuotas: 0, label: 'Plan Z', coefDefault: null },
] as const

export type OpcionCuotaId = (typeof OPCIONES_CUOTAS)[number]['id']

export function calcularTotalesCredito(totalSinInteres: number, coeficiente: number, cuotas: number) {
  const coef = Math.max(0, Number.isFinite(coeficiente) ? coeficiente : 0)
  const interes = totalSinInteres * (coef / 100)
  const totalConInteres = totalSinInteres + interes
  const valorCuota = cuotas > 0 ? totalConInteres / cuotas : totalConInteres
  return { interes, totalConInteres, valorCuota }
}

export async function confirmarVenta(
  client: SupabaseClient,
  input: {
    items: { producto_id: string; cantidad: number; precio_unitario: number }[]
    formaPago: string
    descuento: number
    cliente: string
    clienteId?: string | null
    cuotas?: number
    coeficienteInteres?: number
    totalSinInteres?: number
    totalConInteres?: number
  },
): Promise<string | null> {
  const { error } = await client.rpc('confirmar_venta', {
    p_items: input.items,
    p_forma_pago: input.formaPago,
    p_descuento: input.descuento,
    p_cliente: input.cliente,
    p_cliente_id: input.clienteId ?? null,
    p_cuotas: input.cuotas ?? 1,
    p_coeficiente_interes: input.coeficienteInteres ?? 0,
    p_total_sin_interes: input.totalSinInteres ?? null,
    p_total_con_interes: input.totalConInteres ?? null,
  })
  return error ? error.message : null
}

export async function anularVenta(client: SupabaseClient, id: string): Promise<string | null> {
  const { error } = await client.rpc('anular_venta', { p_id: id })
  return error ? error.message : null
}

export function formatoFechaVenta(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

import type { SupabaseClient } from '@supabase/supabase-js'

export type TipoAjusteStock =
  | 'ajuste_positivo'
  | 'merma'
  | 'rotura'
  | 'perdida'
  | 'consumo_interno'

export const TIPOS_AJUSTE: { id: TipoAjusteStock; label: string }[] = [
  { id: 'ajuste_positivo', label: 'Ajuste positivo (encontré más stock)' },
  { id: 'merma', label: 'Merma (producto dañado en tránsito)' },
  { id: 'rotura', label: 'Rotura (producto roto en el local)' },
  { id: 'perdida', label: 'Pérdida (producto perdido/robado)' },
  { id: 'consumo_interno', label: 'Consumo interno (usado para muestra/regalo)' },
]

export type MovimientoFila = {
  id: string
  tipo: string
  cantidad: number
  signo: number
  motivo: string | null
  fecha: string
}

export function etiquetaMovimiento(tipo: string) {
  if (tipo === 'compra') return { icono: '✅', texto: 'Compra' }
  if (tipo === 'venta') return { icono: '💸', texto: 'Venta' }
  if (tipo === 'devolucion_cliente' || tipo === 'devolucion') return { icono: '↩️', texto: 'Devolución' }
  if (tipo === 'devolucion_proveedor') return { icono: '🏭', texto: 'Devolución proveedor' }
  if (tipo === 'consumo_interno') return { icono: '🎁', texto: 'Consumo interno' }
  if (tipo === 'ajuste_positivo') return { icono: '📦', texto: 'Ajuste positivo' }
  if (tipo === 'merma' || tipo === 'rotura' || tipo === 'perdida' || tipo === 'ajuste_negativo') {
    return { icono: '⚠️', texto: tipo === 'ajuste_negativo' ? 'Merma/Rotura' : tipo.charAt(0).toUpperCase() + tipo.slice(1) }
  }
  return { icono: '•', texto: tipo }
}

export async function listarMovimientosProducto(
  client: SupabaseClient,
  productoId: string,
): Promise<{ filas: MovimientoFila[]; error: string | null }> {
  const { data, error } = await client
    .from('movimientos_inventario')
    .select('id, tipo, cantidad, signo, motivo, fecha')
    .eq('producto_id', productoId)
    .is('deleted_at', null)
    .order('fecha', { ascending: false })
    .limit(50)
  if (error) return { filas: [], error: error.message }
  return {
    filas: ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      tipo: String(row.tipo ?? ''),
      cantidad: Number(row.cantidad ?? 0),
      signo: Number(row.signo ?? 0),
      motivo: row.motivo == null || row.motivo === '' ? null : String(row.motivo),
      fecha: String(row.fecha ?? ''),
    })),
    error: null,
  }
}

export async function ajustarStock(
  client: SupabaseClient,
  input: {
    productoId: string
    tipo: TipoAjusteStock | 'ajuste_negativo'
    cantidad: number
    motivo: string
    varianteId?: string | null
    empresaId?: string
  },
): Promise<string | null> {
  if (input.varianteId && input.empresaId) {
    const { data: auth } = await client.auth.getUser()
    const uid = auth.user?.id
    if (!uid) return 'NO_AUTENTICADO'
    const signo = input.tipo === 'ajuste_positivo' ? 1 : -1
    const { error } = await client.from('movimientos_inventario').insert({
      empresa_id: input.empresaId,
      producto_id: input.productoId,
      usuario_id: uid,
      tipo: input.tipo,
      cantidad: input.cantidad,
      signo,
      motivo: input.motivo.trim(),
      variante_id: input.varianteId,
    })
    if (!error) return null
    return `No se pudo ajustar el stock: ${error.message}`
  }
  const { error } = await client.rpc('ajustar_stock', {
    p_producto_id: input.productoId,
    p_tipo: input.tipo,
    p_cantidad: input.cantidad,
    p_motivo: input.motivo,
  })
  if (!error) return null
  const msg = error.message
  if (msg.includes('NO_AUTORIZADO')) return 'No tenés permiso para ajustar stock'
  if (msg.includes('CANTIDAD_INVALIDA')) return 'La cantidad tiene que ser un número positivo'
  if (msg.includes('MOTIVO_OBLIGATORIO')) return 'El motivo es obligatorio'
  if (msg.includes('PRODUCTO_INVALIDO')) return 'Ese producto ya no está disponible'
  const t = msg.toLowerCase()
  if (t.includes('schema cache') || t.includes('could not find') || t.includes('does not exist')) {
    return 'Falta actualizar inventario en Supabase. Pegá supabase/026_inventario_alertas.sql (rol postgres) y recargá.'
  }
  return `No se pudo ajustar el stock: ${msg}`
}

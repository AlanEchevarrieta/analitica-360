import type { SupabaseClient } from '@supabase/supabase-js'

export type CategoriaFila = {
  id: string
  nombre: string
  descripcion: string
  activo: boolean
}

function msgSql(error: string) {
  const t = error.toLowerCase()
  if (t.includes('schema cache') || t.includes('does not exist') || t.includes('categorias')) {
    return 'Falta el módulo de categorías. Pegá TODO supabase/037_numero_venta_anular_compras_categorias.sql (rol postgres), dale Run y recargá.'
  }
  return error
}

function mapFila(row: Record<string, unknown>): CategoriaFila {
  return {
    id: String(row.id),
    nombre: String(row.nombre ?? ''),
    descripcion: row.descripcion == null ? '' : String(row.descripcion),
    activo: row.activo !== false,
  }
}

export async function listarCategorias(
  client: SupabaseClient,
  soloActivas = false,
): Promise<{ filas: CategoriaFila[]; error: string | null }> {
  let q = client
    .from('categorias')
    .select('id, nombre, descripcion, activo')
    .order('nombre', { ascending: true })
  if (soloActivas) q = q.eq('activo', true)
  const { data, error } = await q
  if (error) return { filas: [], error: msgSql(error.message) }
  return { filas: ((data ?? []) as Record<string, unknown>[]).map(mapFila), error: null }
}

export async function sembrarCategoriasDefault(client: SupabaseClient): Promise<string | null> {
  const { error } = await client.rpc('sembrar_categorias_default')
  if (!error) return null
  return msgSql(error.message)
}

export async function guardarCategoria(
  client: SupabaseClient,
  input: {
    id?: string
    empresaId: string
    nombre: string
    descripcion: string
    activo: boolean
  },
): Promise<string | null> {
  const nombre = input.nombre.trim()
  if (!nombre) return 'El nombre es obligatorio'
  const payload = {
    empresa_id: input.empresaId,
    nombre,
    descripcion: input.descripcion.trim() || null,
    activo: input.activo,
  }
  if (input.id) {
    const { error } = await client.from('categorias').update(payload).eq('id', input.id)
    return error ? msgSql(error.message) : null
  }
  const { error } = await client.from('categorias').insert(payload)
  return error ? msgSql(error.message) : null
}

export async function eliminarCategoria(client: SupabaseClient, id: string): Promise<string | null> {
  const { error: unlink } = await client.from('productos').update({ categoria_id: null }).eq('categoria_id', id)
  if (unlink) return msgSql(unlink.message)
  const { error } = await client.from('categorias').delete().eq('id', id)
  return error ? msgSql(error.message) : null
}

import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const authHeader = req.headers.get('Authorization') ?? ''

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) {
      return Response.json({ error: 'NO_AUTENTICADO' }, { status: 401, headers: cors })
    }

    const { data: perfil, error: perfilError } = await userClient
      .from('usuarios')
      .select('empresa_id, rol')
      .eq('id', userData.user.id)
      .maybeSingle()

    if (perfilError || !perfil || perfil.rol !== 'dueno') {
      return Response.json({ error: 'NO_AUTORIZADO' }, { status: 403, headers: cors })
    }

    const body = await req.json()
    const nombre = String(body.nombre ?? '').trim()
    const email = String(body.email ?? '').trim().toLowerCase()
    const rol = body.rol === 'visor' ? 'visor' : 'operador'
    const permisos = body.permisos ?? {}
    const redirectTo = String(body.redirectTo ?? '')

    if (!nombre || !email) {
      return Response.json({ error: 'Completá nombre y email' }, { status: 400, headers: cors })
    }

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: {
        nombre,
        empresa_id: perfil.empresa_id,
        rol,
        permisos,
      },
      redirectTo: redirectTo || undefined,
    })

    if (inviteError || !invited.user) {
      return Response.json(
        { error: inviteError?.message ?? 'No se pudo enviar el email de invitación' },
        { status: 400, headers: cors },
      )
    }

    const { error: insertError } = await admin.from('usuarios').insert({
      id: invited.user.id,
      empresa_id: perfil.empresa_id,
      nombre,
      email,
      rol,
      activo: true,
      permisos,
    })

    if (insertError) {
      return Response.json({ error: insertError.message }, { status: 400, headers: cors })
    }

    return Response.json({ ok: true }, { headers: cors })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error inesperado'
    return Response.json({ error: message }, { status: 500, headers: cors })
  }
})

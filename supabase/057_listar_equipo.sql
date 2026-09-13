-- Listado de equipo: todos los usuarios de la empresa, no solo invitaciones.
-- SQL Editor, rol postgres. Pegá TODO y dale Run.

DROP POLICY IF EXISTS usuarios_select ON public.usuarios;
CREATE POLICY usuarios_select ON public.usuarios
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_empresa_id());

CREATE OR REPLACE FUNCTION public.listar_equipo()
RETURNS TABLE (
  id uuid,
  nombre text,
  email text,
  rol text,
  activo boolean,
  invitacion_pendiente boolean,
  modulos jsonb,
  acciones jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
  v_user uuid;
BEGIN
  v_user := auth.uid();
  v_empresa := public.get_empresa_id();
  IF v_user IS NULL OR v_empresa IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.nombre,
    u.email,
    u.rol,
    u.activo,
    COALESCE(u.invitacion_pendiente, FALSE),
    cp.modulos,
    cp.acciones
  FROM public.usuarios u
  LEFT JOIN public.colaborador_permisos cp
    ON cp.usuario_id = u.id
   AND cp.empresa_id = u.empresa_id
  WHERE u.empresa_id = v_empresa
    AND u.id <> v_user
    AND u.deleted_at IS NULL
  ORDER BY u.nombre;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.listar_equipo() TO authenticated;

CREATE OR REPLACE FUNCTION public.guardar_colaborador_permisos(
  p_usuario uuid,
  p_modulos jsonb,
  p_acciones jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
BEGIN
  v_empresa := public.get_empresa_id();
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;
  IF public.get_rol() <> 'dueno' THEN
    RAISE EXCEPTION 'NO_AUTORIZADO';
  END IF;
  IF p_usuario = auth.uid() THEN
    RAISE EXCEPTION 'USUARIO_INVALIDO';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = p_usuario
      AND u.empresa_id = v_empresa
      AND u.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'USUARIO_INVALIDO';
  END IF;

  INSERT INTO public.colaborador_permisos (empresa_id, usuario_id, modulos, acciones)
  VALUES (v_empresa, p_usuario, coalesce(p_modulos, '{}'::jsonb), coalesce(p_acciones, '{}'::jsonb))
  ON CONFLICT (empresa_id, usuario_id)
  DO UPDATE SET
    modulos = excluded.modulos,
    acciones = excluded.acciones,
    updated_at = NOW();
END;
$function$;

-- Invitaciones: unirse con cuenta existente, info pública y listado de equipo.
-- SQL Editor, rol postgres. Pegá TODO y dale Run.

CREATE OR REPLACE FUNCTION public.info_invitacion_empresa(p_empresa uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT e.nombre
  FROM public.empresas e
  WHERE e.id = p_empresa
    AND e.deleted_at IS NULL
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.info_invitacion_empresa(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.email_tiene_cuenta(p_email text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, auth
AS $function$
DECLARE
  v_email text;
BEGIN
  v_email := lower(trim(coalesce(p_email, '')));
  IF v_email = '' OR v_email !~ '^[^@]+@[^@]+\.[^@]+$' THEN
    RETURN FALSE;
  END IF;
  RETURN EXISTS (SELECT 1 FROM auth.users a WHERE lower(a.email) = v_email)
      OR EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE lower(u.email) = v_email
          AND u.deleted_at IS NULL
      );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.email_tiene_cuenta(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.aceptar_invitacion_colaborador(
  p_empresa uuid,
  p_rol text,
  p_nombre text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_user uuid;
  v_email text;
  v_rol text;
  v_nombre text;
  v_inv record;
  v_exist record;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;

  SELECT lower(email) INTO v_email FROM auth.users WHERE id = v_user;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'EMAIL_INVALIDO';
  END IF;

  v_rol := 'operario';
  v_nombre := nullif(trim(coalesce(p_nombre, '')), '');
  IF v_nombre IS NULL THEN
    v_nombre := split_part(v_email, '@', 1);
  END IF;

  SELECT * INTO v_inv
  FROM public.invitaciones_colaboradores i
  WHERE i.empresa_id = p_empresa
    AND i.pendiente = TRUE
    AND lower(i.email) = v_email
  ORDER BY i.created_at DESC
  LIMIT 1;

  SELECT * INTO v_exist
  FROM public.usuarios u
  WHERE u.id = v_user
    AND u.deleted_at IS NULL
  LIMIT 1;

  IF v_inv.id IS NULL THEN
    IF v_exist.id IS NOT NULL AND v_exist.empresa_id = p_empresa THEN
      RETURN v_user;
    END IF;
    RAISE EXCEPTION 'INVITACION_INVALIDA';
  END IF;

  IF v_exist.id IS NOT NULL THEN
    IF v_exist.empresa_id = p_empresa THEN
      UPDATE public.usuarios
      SET activo = TRUE,
          invitacion_pendiente = FALSE,
          deleted_at = NULL,
          nombre = CASE WHEN nullif(trim(v_exist.nombre), '') IS NULL THEN v_nombre ELSE v_exist.nombre END
      WHERE id = v_user;
    ELSIF v_exist.rol = 'dueno' THEN
      RAISE EXCEPTION 'YA_ES_DUENO';
    ELSE
      UPDATE public.usuarios
      SET empresa_id = v_inv.empresa_id,
          rol = v_rol,
          activo = TRUE,
          invitacion_pendiente = FALSE,
          deleted_at = NULL,
          invitado_por = v_inv.invitado_por,
          nombre = CASE WHEN nullif(trim(v_exist.nombre), '') IS NULL THEN v_nombre ELSE v_exist.nombre END
      WHERE id = v_user;
    END IF;
  ELSE
    INSERT INTO public.usuarios (
      id, empresa_id, nombre, email, rol, activo, invitado_por, invitacion_pendiente
    ) VALUES (
      v_user,
      v_inv.empresa_id,
      v_nombre,
      v_email,
      v_rol,
      TRUE,
      v_inv.invitado_por,
      FALSE
    );
  END IF;

  INSERT INTO public.colaborador_permisos (empresa_id, usuario_id, modulos, acciones)
  VALUES (
    v_inv.empresa_id,
    v_user,
    coalesce(v_inv.modulos, '{}'::jsonb),
    coalesce(v_inv.acciones, '{}'::jsonb)
  )
  ON CONFLICT (empresa_id, usuario_id)
  DO UPDATE SET
    modulos = excluded.modulos,
    acciones = excluded.acciones,
    updated_at = NOW();

  UPDATE public.invitaciones_colaboradores
  SET pendiente = FALSE
  WHERE id = v_inv.id;

  RETURN v_user;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.aceptar_invitacion_colaborador(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.eliminar_colaborador(p_usuario uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
  v_email text;
BEGIN
  v_empresa := public.get_empresa_id();
  IF v_empresa IS NULL OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;
  IF public.get_rol() <> 'dueno' THEN
    RAISE EXCEPTION 'NO_AUTORIZADO';
  END IF;
  IF p_usuario = auth.uid() THEN
    RAISE EXCEPTION 'USUARIO_INVALIDO';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.invitaciones_colaboradores i
    WHERE i.id = p_usuario AND i.empresa_id = v_empresa
  ) THEN
    UPDATE public.invitaciones_colaboradores
    SET pendiente = FALSE
    WHERE id = p_usuario AND empresa_id = v_empresa;
    RETURN;
  END IF;

  SELECT u.email INTO v_email
  FROM public.usuarios u
  WHERE u.id = p_usuario
    AND u.empresa_id = v_empresa
    AND u.rol <> 'dueno';

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'USUARIO_INVALIDO';
  END IF;

  UPDATE public.usuarios
  SET deleted_at = NOW(),
      activo = FALSE
  WHERE id = p_usuario
    AND empresa_id = v_empresa;

  UPDATE public.invitaciones_colaboradores
  SET pendiente = FALSE
  WHERE empresa_id = v_empresa
    AND lower(email) = lower(v_email)
    AND pendiente = TRUE;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.eliminar_colaborador(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.listar_equipo();

CREATE OR REPLACE FUNCTION public.listar_equipo()
RETURNS TABLE (
  id uuid,
  nombre text,
  email text,
  rol text,
  activo boolean,
  invitacion_pendiente boolean,
  es_invitacion boolean,
  ultimo_acceso timestamptz,
  modulos jsonb,
  acciones jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, auth
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
  SELECT * FROM (
    SELECT
      u.id,
      u.nombre,
      u.email,
      u.rol,
      u.activo,
      COALESCE(u.invitacion_pendiente, FALSE) AS invitacion_pendiente,
      FALSE AS es_invitacion,
      au.last_sign_in_at AS ultimo_acceso,
      cp.modulos,
      cp.acciones
    FROM public.usuarios u
    LEFT JOIN public.colaborador_permisos cp
      ON cp.usuario_id = u.id
     AND cp.empresa_id = u.empresa_id
    LEFT JOIN auth.users au ON au.id = u.id
    WHERE u.empresa_id = v_empresa
      AND u.id <> v_user
      AND u.deleted_at IS NULL

    UNION ALL

    SELECT
      i.id,
      split_part(i.email, '@', 1),
      i.email,
      i.rol,
      FALSE,
      TRUE,
      TRUE,
      NULL::timestamptz,
      i.modulos,
      i.acciones
    FROM public.invitaciones_colaboradores i
    WHERE i.empresa_id = v_empresa
      AND i.pendiente = TRUE
      AND NOT EXISTS (
        SELECT 1 FROM public.usuarios u2
        WHERE u2.empresa_id = v_empresa
          AND lower(u2.email) = lower(i.email)
          AND u2.deleted_at IS NULL
      )
  ) equipo
  ORDER BY equipo.invitacion_pendiente DESC, equipo.nombre;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.listar_equipo() TO authenticated;

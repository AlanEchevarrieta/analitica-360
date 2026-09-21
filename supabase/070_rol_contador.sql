-- Rol contador: solo lectura, no consume licencia del plan.
-- SQL Editor, rol postgres. Pegá TODO y dale Run.

ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;

ALTER TABLE public.usuarios
  ADD CONSTRAINT usuarios_rol_check
  CHECK (rol IN ('dueno', 'administrador', 'operario', 'contador'));

ALTER TABLE public.invitaciones_colaboradores DROP CONSTRAINT IF EXISTS invitaciones_colaboradores_rol_check;

ALTER TABLE public.invitaciones_colaboradores
  ADD CONSTRAINT invitaciones_colaboradores_rol_check
  CHECK (rol IN ('administrador', 'operario', 'contador'));

CREATE OR REPLACE FUNCTION public.get_rol()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE rol
    WHEN 'administrador' THEN 'dueno'
    WHEN 'operario' THEN 'operador'
    ELSE rol
  END
  FROM public.usuarios
  WHERE id = auth.uid()
    AND deleted_at IS NULL
    AND activo = TRUE
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.invitar_contador(p_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
  v_email text;
  v_id uuid;
  v_modulos jsonb := jsonb_build_object(
    'inicio', true,
    'productos', true,
    'ventas', true,
    'compras', true,
    'analytics', true,
    'contabilidad', true,
    'clientes', false,
    'proveedores', false,
    'pedidos', false,
    'inventario', false,
    'insights', false,
    'configuracion', false
  );
  v_acciones jsonb := jsonb_build_object(
    'registrar_ventas', false,
    'crear_pedidos', false,
    'hacer_picking', false,
    'editar_productos', false,
    'ver_costos', true,
    'anular_ventas', false,
    'importar_datos', false,
    'ver_reportes', true,
    'gestionar_clientes', false
  );
BEGIN
  v_empresa := public.get_empresa_id();
  IF v_empresa IS NULL OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;
  IF public.get_rol() <> 'dueno' THEN
    RAISE EXCEPTION 'NO_AUTORIZADO';
  END IF;

  v_email := lower(trim(coalesce(p_email, '')));
  IF v_email IS NULL OR v_email !~ '^[^@]+@[^@]+\.[^@]+$' THEN
    RAISE EXCEPTION 'EMAIL_INVALIDO';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.empresa_id = v_empresa
      AND lower(u.email) = v_email
      AND u.deleted_at IS NULL
      AND u.activo = TRUE
  ) THEN
    RAISE EXCEPTION 'EMAIL_YA_REGISTRADO';
  END IF;

  UPDATE public.invitaciones_colaboradores
  SET pendiente = FALSE
  WHERE empresa_id = v_empresa
    AND lower(email) = v_email
    AND pendiente = TRUE;

  INSERT INTO public.invitaciones_colaboradores (
    empresa_id, email, rol, invitado_por, pendiente, modulos, acciones
  ) VALUES (
    v_empresa, v_email, 'contador', auth.uid(), TRUE, v_modulos, v_acciones
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.invitar_contador(text) TO authenticated;

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
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;

  SELECT lower(email) INTO v_email FROM auth.users WHERE id = v_user;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'EMAIL_INVALIDO';
  END IF;

  IF EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = v_user AND u.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'YA_TIENE_EMPRESA';
  END IF;

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

  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'INVITACION_INVALIDA';
  END IF;

  v_rol := CASE WHEN v_inv.rol = 'contador' THEN 'contador' ELSE 'operario' END;

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

NOTIFY pgrst, 'reload schema';

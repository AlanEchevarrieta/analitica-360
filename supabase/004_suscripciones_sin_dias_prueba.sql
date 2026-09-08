-- Corregí admin_asignar_suscripcion y registrar_empresa:
-- tu tabla suscripciones no tiene la columna dias_prueba.
-- Pegá TODO este archivo en el SQL Editor y dale Run.

CREATE OR REPLACE FUNCTION public.registrar_empresa(
  p_nombre_empresa text,
  p_rubro text,
  p_nombre_usuario text,
  p_user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_user_id uuid;
  v_empresa_id uuid;
  v_email text;
  v_nombre text;
  v_plan_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;

  IF EXISTS (SELECT 1 FROM public.usuarios WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'YA_TIENE_EMPRESA';
  END IF;

  IF p_nombre_empresa IS NULL OR length(trim(p_nombre_empresa)) = 0 THEN
    RAISE EXCEPTION 'NOMBRE_EMPRESA_OBLIGATORIO';
  END IF;

  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_user_id;

  v_nombre := nullif(trim(coalesce(p_nombre_usuario, '')), '');
  IF v_nombre IS NULL THEN
    v_nombre := trim(p_nombre_empresa);
  END IF;

  INSERT INTO public.empresas (nombre, rubro)
  VALUES (trim(p_nombre_empresa), nullif(trim(coalesce(p_rubro, '')), ''))
  RETURNING id INTO v_empresa_id;

  INSERT INTO public.usuarios (id, empresa_id, nombre, email, rol)
  VALUES (v_user_id, v_empresa_id, v_nombre, coalesce(v_email, ''), 'dueno');

  INSERT INTO public.historial_planes (empresa_id, plan_anterior, plan_nuevo, motivo)
  VALUES (v_empresa_id, NULL, 'starter', 'alta inicial');

  SELECT p.id INTO v_plan_id
  FROM public.planes p
  WHERE lower(p.nombre) = 'starter'
  ORDER BY p.created_at
  LIMIT 1;

  IF v_plan_id IS NOT NULL THEN
    INSERT INTO public.suscripciones (
      empresa_id,
      plan_id,
      estado,
      fecha_inicio,
      fecha_vencimiento
    ) VALUES (
      v_empresa_id,
      v_plan_id,
      'periodo_prueba',
      CURRENT_DATE,
      (CURRENT_DATE + interval '14 days')::date
    );
  END IF;

  INSERT INTO public.aceptaciones_terminos (empresa_id, usuario_id, version, user_agent)
  VALUES (
    v_empresa_id,
    v_user_id,
    '1.0',
    nullif(trim(coalesce(p_user_agent, '')), '')
  );

  RETURN v_empresa_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_asignar_suscripcion(
  p_empresa_id uuid,
  p_plan_id uuid,
  p_fecha_vencimiento date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_sub uuid;
  v_estado text;
BEGIN
  IF NOT public.es_admin_app() THEN
    RAISE EXCEPTION 'NO_AUTORIZADO';
  END IF;

  IF p_fecha_vencimiento IS NULL THEN
    RAISE EXCEPTION 'FECHA_INVALIDA';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = p_empresa_id AND e.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'EMPRESA_INVALIDA';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.planes p WHERE p.id = p_plan_id) THEN
    RAISE EXCEPTION 'PLAN_INVALIDO';
  END IF;

  IF p_fecha_vencimiento >= CURRENT_DATE THEN
    v_estado := 'activa';
  ELSE
    v_estado := 'vencida';
  END IF;

  SELECT s.id INTO v_sub
  FROM public.suscripciones s
  WHERE s.empresa_id = p_empresa_id
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_sub IS NULL THEN
    INSERT INTO public.suscripciones (
      empresa_id,
      plan_id,
      estado,
      fecha_inicio,
      fecha_vencimiento
    ) VALUES (
      p_empresa_id,
      p_plan_id,
      v_estado,
      CURRENT_DATE,
      p_fecha_vencimiento
    )
    RETURNING id INTO v_sub;
  ELSE
    UPDATE public.suscripciones
    SET
      plan_id = p_plan_id,
      fecha_vencimiento = p_fecha_vencimiento,
      estado = v_estado
    WHERE id = v_sub;
  END IF;

  RETURN v_sub;
END;
$function$;

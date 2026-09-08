-- Catálogo de planes (starter / basico / pro / premium) y plan_actual al asignar.
-- Pegá TODO el archivo en el SQL Editor y dale Run.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'empresas'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%plan_actual%'
  LOOP
    EXECUTE format('ALTER TABLE public.empresas DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.empresas
  ADD CONSTRAINT empresas_plan_actual_check
  CHECK (plan_actual IN ('starter', 'basico', 'pro', 'premium', 'business'));

INSERT INTO public.planes (nombre, precio_ars, descripcion, max_usuarios, max_productos)
SELECT 'starter', 0, 'Plan gratuito — período de prueba 14 días', 1, 50
WHERE NOT EXISTS (SELECT 1 FROM public.planes p WHERE lower(p.nombre) = 'starter');

INSERT INTO public.planes (nombre, precio_ars, descripcion, max_usuarios, max_productos)
SELECT 'basico', 15000, 'Plan básico — hasta 3 usuarios y 200 productos', 3, 200
WHERE NOT EXISTS (SELECT 1 FROM public.planes p WHERE lower(p.nombre) IN ('basico', 'básico'));

INSERT INTO public.planes (nombre, precio_ars, descripcion, max_usuarios, max_productos)
SELECT 'pro', 35000, 'Plan profesional — hasta 10 usuarios y productos ilimitados', 10, 9999
WHERE NOT EXISTS (SELECT 1 FROM public.planes p WHERE lower(p.nombre) = 'pro');

INSERT INTO public.planes (nombre, precio_ars, descripcion, max_usuarios, max_productos)
SELECT 'premium', 70000, 'Plan completo — usuarios ilimitados, reportes avanzados', 999, 9999
WHERE NOT EXISTS (SELECT 1 FROM public.planes p WHERE lower(p.nombre) = 'premium');

DROP FUNCTION IF EXISTS public.admin_listar_suscripciones();

CREATE OR REPLACE FUNCTION public.admin_listar_suscripciones()
RETURNS TABLE (
  suscripcion_id uuid,
  empresa_id uuid,
  empresa_nombre text,
  estado text,
  fecha_vencimiento date,
  plan_nombre text,
  plan_actual text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
BEGIN
  IF NOT public.es_admin_app() THEN
    RAISE EXCEPTION 'NO_AUTORIZADO';
  END IF;

  RETURN QUERY
  SELECT DISTINCT ON (e.id)
    s.id,
    e.id,
    e.nombre,
    s.estado,
    s.fecha_vencimiento,
    p.nombre,
    e.plan_actual
  FROM public.empresas e
  LEFT JOIN public.suscripciones s ON s.empresa_id = e.id
  LEFT JOIN public.planes p ON p.id = s.plan_id
  WHERE e.deleted_at IS NULL
  ORDER BY e.id, s.created_at DESC NULLS LAST;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_listar_suscripciones() TO authenticated;

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
  v_plan text;
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

  SELECT lower(p.nombre) INTO v_plan
  FROM public.planes p
  WHERE p.id = p_plan_id;
  IF v_plan IS NULL THEN
    RAISE EXCEPTION 'PLAN_INVALIDO';
  END IF;
  IF v_plan = 'básico' THEN
    v_plan := 'basico';
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
      empresa_id, plan_id, estado, fecha_inicio, fecha_vencimiento
    ) VALUES (
      p_empresa_id, p_plan_id, v_estado, CURRENT_DATE, p_fecha_vencimiento
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

  UPDATE public.empresas
  SET plan_actual = CASE
    WHEN v_plan IN ('starter', 'basico', 'pro', 'premium', 'business') THEN v_plan
    ELSE plan_actual
  END
  WHERE id = p_empresa_id;

  RETURN v_sub;
END;
$function$;

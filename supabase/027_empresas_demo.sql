-- Empresas de demostración en /admin.
-- SQL Editor, rol postgres. Pegá TODO y dale Run.

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS es_demo BOOLEAN DEFAULT FALSE;

UPDATE public.empresas
SET es_demo = FALSE
WHERE es_demo IS NULL;

DROP FUNCTION IF EXISTS public.admin_listar_suscripciones();

CREATE OR REPLACE FUNCTION public.admin_listar_suscripciones()
RETURNS TABLE (
  suscripcion_id uuid,
  empresa_id uuid,
  empresa_nombre text,
  estado text,
  fecha_vencimiento date,
  plan_nombre text,
  plan_actual text,
  es_demo boolean
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
    e.plan_actual,
    COALESCE(e.es_demo, FALSE)
  FROM public.empresas e
  LEFT JOIN public.suscripciones s ON s.empresa_id = e.id
  LEFT JOIN public.planes p ON p.id = s.plan_id
  WHERE e.deleted_at IS NULL
  ORDER BY e.id, s.created_at DESC NULLS LAST;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_listar_suscripciones() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_marcar_demo(p_empresa_id uuid, p_es_demo boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
BEGIN
  IF NOT public.es_admin_app() THEN
    RAISE EXCEPTION 'NO_AUTORIZADO';
  END IF;

  UPDATE public.empresas
  SET es_demo = COALESCE(p_es_demo, FALSE)
  WHERE id = p_empresa_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EMPRESA_INVALIDA';
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_marcar_demo(uuid, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';

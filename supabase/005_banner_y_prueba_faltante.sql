-- Banner en el home + prueba para empresas que todavía no tienen suscripción.
-- Pegá TODO el archivo en el SQL Editor y dale Run.

INSERT INTO public.suscripciones (
  empresa_id,
  plan_id,
  estado,
  fecha_inicio,
  fecha_vencimiento
)
SELECT
  e.id,
  (
    SELECT p.id
    FROM public.planes p
    WHERE lower(p.nombre) = 'starter'
    ORDER BY p.created_at
    LIMIT 1
  ),
  'periodo_prueba',
  CURRENT_DATE,
  (CURRENT_DATE + interval '14 days')::date
FROM public.empresas e
WHERE e.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.suscripciones s WHERE s.empresa_id = e.id
  )
  AND EXISTS (SELECT 1 FROM public.planes p WHERE lower(p.nombre) = 'starter');

CREATE OR REPLACE FUNCTION public.mi_suscripcion_activa()
RETURNS TABLE (
  suscripcion_id uuid,
  estado text,
  fecha_vencimiento date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
  v_plan uuid;
BEGIN
  v_empresa := public.get_empresa_id();
  IF v_empresa IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.suscripciones s WHERE s.empresa_id = v_empresa
  ) THEN
    SELECT p.id INTO v_plan
    FROM public.planes p
    WHERE lower(p.nombre) = 'starter'
    ORDER BY p.created_at
    LIMIT 1;

    IF v_plan IS NOT NULL THEN
      INSERT INTO public.suscripciones (
        empresa_id,
        plan_id,
        estado,
        fecha_inicio,
        fecha_vencimiento
      ) VALUES (
        v_empresa,
        v_plan,
        'periodo_prueba',
        CURRENT_DATE,
        (CURRENT_DATE + interval '14 days')::date
      );
    END IF;
  END IF;

  RETURN QUERY
  SELECT s.id, s.estado, s.fecha_vencimiento
  FROM public.suscripciones s
  WHERE s.empresa_id = v_empresa
  ORDER BY s.fecha_vencimiento DESC NULLS LAST
  LIMIT 1;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.mi_suscripcion_activa() TO authenticated;

-- Métricas SaaS para /admin.
-- SQL Editor, rol postgres. Pegá TODO y dale Run.

DROP FUNCTION IF EXISTS public.admin_saas_metrics();

CREATE OR REPLACE FUNCTION public.admin_saas_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_result JSONB;
  v_mes_inicio DATE := DATE_TRUNC('month', CURRENT_DATE)::DATE;
  v_mes_anterior DATE := DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')::DATE;
  v_pagos NUMERIC := 0;
BEGIN
  IF NOT public.es_admin_app() THEN
    RAISE EXCEPTION 'NO_AUTORIZADO';
  END IF;

  BEGIN
    SELECT COALESCE(SUM(pago.monto_ars), 0) INTO v_pagos
    FROM public.pagos AS pago
    WHERE pago.estado = 'confirmado'
      AND pago.created_at >= v_mes_inicio;
  EXCEPTION
    WHEN undefined_table THEN
      v_pagos := 0;
    WHEN undefined_column THEN
      v_pagos := 0;
  END;

  SELECT jsonb_build_object(
    'mrr', COALESCE((
      SELECT SUM(pl.precio_ars)
      FROM public.suscripciones s
      JOIN public.planes pl ON pl.id = s.plan_id
      WHERE s.estado = 'activa'
        AND COALESCE(pl.precio_ars, 0) > 0
    ), 0),
    'total_empresas', (
      SELECT COUNT(*)::int FROM public.empresas WHERE deleted_at IS NULL
    ),
    'activas', (
      SELECT COUNT(*)::int FROM public.suscripciones WHERE estado = 'activa'
    ),
    'en_prueba', (
      SELECT COUNT(*)::int FROM public.suscripciones WHERE estado = 'periodo_prueba'
    ),
    'vencidas', (
      SELECT COUNT(*)::int
      FROM public.suscripciones
      WHERE estado IN ('vencida', 'pendiente_pago')
    ),
    'nuevas_este_mes', (
      SELECT COUNT(*)::int
      FROM public.empresas
      WHERE created_at >= v_mes_inicio
        AND deleted_at IS NULL
    ),
    'nuevas_mes_anterior', (
      SELECT COUNT(*)::int
      FROM public.empresas
      WHERE created_at >= v_mes_anterior
        AND created_at < v_mes_inicio
        AND deleted_at IS NULL
    ),
    'pagos_este_mes', v_pagos,
    'empresas_por_plan', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('plan', ep.plan, 'cantidad', ep.cantidad)
        ORDER BY ep.cantidad DESC
      )
      FROM (
        SELECT pl.nombre AS plan, COUNT(*)::int AS cantidad
        FROM public.suscripciones s
        JOIN public.planes pl ON pl.id = s.plan_id
        WHERE s.estado IN ('activa', 'periodo_prueba')
        GROUP BY pl.nombre
      ) ep
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_saas_metrics() TO authenticated;

NOTIFY pgrst, 'reload schema';

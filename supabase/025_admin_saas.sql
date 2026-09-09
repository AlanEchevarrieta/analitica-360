-- SaaS metrics + tabla pagos (panel /admin).
-- SQL Editor, rol postgres. Pegá TODO y dale Run.
-- Solo se ejecuta si public.es_admin_app() es verdadero.

CREATE TABLE IF NOT EXISTS public.pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  monto_ars NUMERIC(12,2) NOT NULL,
  metodo TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'confirmado',
  periodo DATE,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pagos_empresa_fecha ON public.pagos(empresa_id, created_at DESC);

ALTER TABLE public.pagos ADD COLUMN IF NOT EXISTS periodo DATE;
ALTER TABLE public.pagos ADD COLUMN IF NOT EXISTS notas TEXT;
ALTER TABLE public.pagos ADD COLUMN IF NOT EXISTS monto_ars NUMERIC(12,2);
ALTER TABLE public.pagos ADD COLUMN IF NOT EXISTS metodo TEXT;
ALTER TABLE public.pagos ADD COLUMN IF NOT EXISTS estado TEXT;

ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.pagos TO authenticated;

DROP POLICY IF EXISTS pagos_admin_all ON public.pagos;
CREATE POLICY pagos_admin_all ON public.pagos
  FOR ALL USING (public.es_admin_app())
  WITH CHECK (public.es_admin_app());

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
    SELECT COALESCE(SUM(monto_ars), 0) INTO v_pagos
    FROM public.pagos
    WHERE estado = 'confirmado'
      AND created_at >= v_mes_inicio;
  EXCEPTION
    WHEN undefined_table THEN
      v_pagos := 0;
  END;

  SELECT jsonb_build_object(
    'mrr', COALESCE((
      SELECT SUM(p.precio_ars)
      FROM public.suscripciones s
      JOIN public.planes p ON p.id = s.plan_id
      WHERE s.estado = 'activa'
        AND p.precio_ars > 0
    ), 0),
    'total_empresas', (SELECT COUNT(*) FROM public.empresas WHERE deleted_at IS NULL),
    'activas', (SELECT COUNT(*) FROM public.suscripciones WHERE estado = 'activa'),
    'en_prueba', (SELECT COUNT(*) FROM public.suscripciones WHERE estado = 'periodo_prueba'),
    'vencidas', (SELECT COUNT(*) FROM public.suscripciones WHERE estado IN ('vencida', 'pendiente_pago')),
    'nuevas_este_mes', (
      SELECT COUNT(*) FROM public.empresas
      WHERE created_at >= v_mes_inicio AND deleted_at IS NULL
    ),
    'nuevas_mes_anterior', (
      SELECT COUNT(*) FROM public.empresas
      WHERE created_at >= v_mes_anterior
        AND created_at < v_mes_inicio
        AND deleted_at IS NULL
    ),
    'pagos_este_mes', v_pagos,
    'empresas_por_plan', COALESCE((
      SELECT jsonb_agg(ep)
      FROM (
        SELECT p.nombre AS plan, COUNT(*)::int AS cantidad
        FROM public.suscripciones s
        JOIN public.planes p ON p.id = s.plan_id
        WHERE s.estado = 'activa'
        GROUP BY p.nombre
        ORDER BY COUNT(*) DESC
      ) ep
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_saas_metrics() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_listar_pagos(p_estado text DEFAULT NULL, p_periodo date DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  empresa_id uuid,
  empresa_nombre text,
  monto_ars numeric,
  metodo text,
  estado text,
  periodo date,
  notas text,
  created_at timestamptz
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
  SELECT
    pago.id,
    pago.empresa_id,
    e.nombre,
    pago.monto_ars,
    pago.metodo,
    pago.estado,
    pago.periodo,
    pago.notas,
    pago.created_at
  FROM public.pagos AS pago
  JOIN public.empresas e ON e.id = pago.empresa_id
  WHERE (p_estado IS NULL OR p_estado = '' OR pago.estado = p_estado)
    AND (
      p_periodo IS NULL
      OR date_trunc('month', COALESCE(pago.periodo, pago.created_at::date))::date = p_periodo
    )
  ORDER BY pago.created_at DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_listar_pagos(text, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_registrar_pago(
  p_empresa_id uuid,
  p_monto numeric,
  p_metodo text,
  p_periodo date,
  p_notas text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_id uuid;
  v_fin date;
BEGIN
  IF NOT public.es_admin_app() THEN
    RAISE EXCEPTION 'NO_AUTORIZADO';
  END IF;
  IF p_empresa_id IS NULL THEN
    RAISE EXCEPTION 'EMPRESA_INVALIDA';
  END IF;
  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'MONTO_INVALIDO';
  END IF;
  IF p_metodo IS NULL OR length(trim(p_metodo)) = 0 THEN
    RAISE EXCEPTION 'METODO_INVALIDO';
  END IF;

  INSERT INTO public.pagos (empresa_id, monto_ars, metodo, estado, periodo, notas)
  VALUES (
    p_empresa_id,
    p_monto,
    trim(p_metodo),
    'confirmado',
    date_trunc('month', COALESCE(p_periodo, CURRENT_DATE))::date,
    nullif(trim(coalesce(p_notas, '')), '')
  )
  RETURNING id INTO v_id;

  v_fin := (date_trunc('month', COALESCE(p_periodo, CURRENT_DATE)) + interval '1 month' - interval '1 day')::date;

  UPDATE public.suscripciones
  SET
    estado = 'activa',
    fecha_vencimiento = GREATEST(COALESCE(fecha_vencimiento, v_fin), v_fin)
  WHERE empresa_id = p_empresa_id;

  RETURN v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_registrar_pago(uuid, numeric, text, date, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

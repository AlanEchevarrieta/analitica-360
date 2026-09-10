-- SQL Editor, rol postgres. Primero inspeccioná, después reemplazá.

SELECT prosrc FROM pg_proc
WHERE proname = 'analytics_periodo';

CREATE OR REPLACE FUNCTION public.analytics_periodo(
  p_desde date,
  p_hasta date,
  p_empresa_id uuid DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
SET statement_timeout = '15s'
AS $$
  SELECT jsonb_build_object(
    'total_ventas', COALESCE(SUM(total_con_interes), 0),
    'cantidad', COUNT(*),
    'ticket_promedio', COALESCE(AVG(total_con_interes), 0),
    'ventas', COALESCE(jsonb_agg(
      jsonb_build_object(
        'fecha', fecha,
        'total', total_con_interes,
        'forma_pago', forma_pago
      )
      ORDER BY fecha
    ), '[]'::jsonb)
  )
  FROM ventas
  WHERE empresa_id = COALESCE(p_empresa_id, get_empresa_id())
    AND fecha BETWEEN p_desde AND p_hasta
    AND deleted_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.analytics_periodo(date, date, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Agregaciones de Analytics en el servidor (GROUP BY).
-- SQL Editor, rol postgres. Pegá TODO y dale Run.

CREATE OR REPLACE FUNCTION public.analytics_evolucion(
  p_desde date,
  p_hasta date,
  p_granularidad text DEFAULT 'semana'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
  v_tz text := 'America/Argentina/Buenos_Aires';
  v_unit text;
  v_dias int;
  v_ant_desde date;
  v_ant_hasta date;
  v_out jsonb;
BEGIN
  v_empresa := public.get_empresa_id();
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;
  IF p_desde IS NULL OR p_hasta IS NULL OR p_hasta < p_desde THEN
    RAISE EXCEPTION 'PERIODO_INVALIDO';
  END IF;

  v_unit := CASE lower(coalesce(p_granularidad, 'semana'))
    WHEN 'dia' THEN 'day'
    WHEN 'mes' THEN 'month'
    ELSE 'week'
  END;
  v_dias := (p_hasta - p_desde) + 1;
  v_ant_hasta := p_desde - 1;
  v_ant_desde := v_ant_hasta - v_dias + 1;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'fecha', p.periodo,
    'Ventas', p.total,
    'Anterior', p.anterior,
    'cantidad', p.cantidad
  ) ORDER BY p.periodo), '[]'::jsonb)
  INTO v_out
  FROM (
    SELECT
      COALESCE(a.periodo, b.periodo) AS periodo,
      COALESCE(a.total, 0) AS total,
      COALESCE(b.total, 0) AS anterior,
      COALESCE(a.cantidad, 0) AS cantidad
    FROM (
      SELECT
        DATE_TRUNC(v_unit, (v.fecha AT TIME ZONE v_tz))::date AS periodo,
        SUM(public.monto_venta(v)) AS total,
        COUNT(*)::int AS cantidad
      FROM public.ventas v
      WHERE v.empresa_id = v_empresa
        AND v.deleted_at IS NULL
        AND (v.fecha AT TIME ZONE v_tz)::date BETWEEN p_desde AND p_hasta
      GROUP BY 1
    ) a
    FULL JOIN (
      SELECT
        (DATE_TRUNC(v_unit, (v.fecha AT TIME ZONE v_tz) + (v_dias || ' days')::interval))::date AS periodo,
        SUM(public.monto_venta(v)) AS total
      FROM public.ventas v
      WHERE v.empresa_id = v_empresa
        AND v.deleted_at IS NULL
        AND (v.fecha AT TIME ZONE v_tz)::date BETWEEN v_ant_desde AND v_ant_hasta
      GROUP BY 1
    ) b ON b.periodo = a.periodo
  ) p
  WHERE p.periodo IS NOT NULL;

  RETURN COALESCE(v_out, '[]'::jsonb);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.analytics_evolucion(date, date, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.analytics_formas_pago(p_desde date, p_hasta date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
  v_tz text := 'America/Argentina/Buenos_Aires';
  v_out jsonb;
BEGIN
  v_empresa := public.get_empresa_id();
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;
  IF p_desde IS NULL OR p_hasta IS NULL OR p_hasta < p_desde THEN
    RAISE EXCEPTION 'PERIODO_INVALIDO';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'name', p.forma,
    'value', p.total,
    'cantidad', p.cantidad
  ) ORDER BY p.total DESC), '[]'::jsonb)
  INTO v_out
  FROM (
    SELECT
      CASE v.forma_pago
        WHEN 'efectivo' THEN 'Efectivo'
        WHEN 'transferencia' THEN 'Transferencia'
        WHEN 'debito' THEN 'Débito'
        WHEN 'credito' THEN 'Crédito'
        WHEN 'qr' THEN 'MP QR'
        ELSE v.forma_pago
      END AS forma,
      SUM(public.monto_venta(v)) AS total,
      COUNT(*)::int AS cantidad
    FROM public.ventas v
    WHERE v.empresa_id = v_empresa
      AND v.deleted_at IS NULL
      AND (v.fecha AT TIME ZONE v_tz)::date BETWEEN p_desde AND p_hasta
    GROUP BY v.forma_pago
  ) p
  WHERE p.total > 0;

  RETURN COALESCE(v_out, '[]'::jsonb);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.analytics_formas_pago(date, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.analytics_top_productos(p_desde date, p_hasta date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
  v_tz text := 'America/Argentina/Buenos_Aires';
  v_out jsonb;
BEGIN
  v_empresa := public.get_empresa_id();
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;
  IF p_desde IS NULL OR p_hasta IS NULL OR p_hasta < p_desde THEN
    RAISE EXCEPTION 'PERIODO_INVALIDO';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'nombre', z.nombre,
    'unidades', z.unidades,
    'total', z.total
  ) ORDER BY z.total DESC, z.nombre), '[]'::jsonb)
  INTO v_out
  FROM (
    SELECT
      p.nombre,
      SUM(vi.cantidad)::int AS unidades,
      SUM(vi.cantidad * vi.precio_unitario) AS total
    FROM public.ventas_items vi
    JOIN public.ventas v ON v.id = vi.venta_id
    JOIN public.productos p ON p.id = vi.producto_id
    WHERE v.empresa_id = v_empresa
      AND v.deleted_at IS NULL
      AND (v.fecha AT TIME ZONE v_tz)::date BETWEEN p_desde AND p_hasta
    GROUP BY p.nombre
    ORDER BY SUM(vi.cantidad * vi.precio_unitario) DESC, p.nombre
    LIMIT 10
  ) z;

  RETURN COALESCE(v_out, '[]'::jsonb);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.analytics_top_productos(date, date) TO authenticated;

NOTIFY pgrst, 'reload schema';

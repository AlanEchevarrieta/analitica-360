-- Stock en el dashboard. Si ya corriste 012, pegá este archivo y dale Run.

CREATE OR REPLACE FUNCTION public.dashboard_inicio()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
  v_hoy date;
  v_lunes date;
  v_mes date;
  v_tz text := 'America/Argentina/Buenos_Aires';
  v_hoy_json jsonb;
  v_semana numeric;
  v_mes_total numeric;
  v_top_hoy jsonb;
  v_dias jsonb;
  v_top5 jsonb;
  v_stock jsonb;
BEGIN
  v_empresa := public.get_empresa_id();
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;

  v_hoy := (now() AT TIME ZONE v_tz)::date;
  v_lunes := v_hoy - (((extract(dow FROM v_hoy)::int + 6) % 7));
  v_mes := date_trunc('month', v_hoy::timestamp)::date;

  SELECT jsonb_build_object(
    'cantidad', COUNT(v.id),
    'total', COALESCE(SUM(t.total), 0)
  )
  INTO v_hoy_json
  FROM public.ventas v
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(i.precio_unitario * i.cantidad), 0) - COALESCE(v.descuento, 0) AS total
    FROM public.ventas_items i
    WHERE i.venta_id = v.id
  ) t ON TRUE
  WHERE v.empresa_id = v_empresa
    AND v.deleted_at IS NULL
    AND (v.fecha AT TIME ZONE v_tz)::date = v_hoy;

  SELECT COALESCE(SUM(t.total), 0)
  INTO v_semana
  FROM public.ventas v
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(i.precio_unitario * i.cantidad), 0) - COALESCE(v.descuento, 0) AS total
    FROM public.ventas_items i
    WHERE i.venta_id = v.id
  ) t ON TRUE
  WHERE v.empresa_id = v_empresa
    AND v.deleted_at IS NULL
    AND (v.fecha AT TIME ZONE v_tz)::date BETWEEN v_lunes AND v_hoy;

  SELECT COALESCE(SUM(t.total), 0)
  INTO v_mes_total
  FROM public.ventas v
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(i.precio_unitario * i.cantidad), 0) - COALESCE(v.descuento, 0) AS total
    FROM public.ventas_items i
    WHERE i.venta_id = v.id
  ) t ON TRUE
  WHERE v.empresa_id = v_empresa
    AND v.deleted_at IS NULL
    AND (v.fecha AT TIME ZONE v_tz)::date >= v_mes
    AND (v.fecha AT TIME ZONE v_tz)::date <= v_hoy;

  SELECT jsonb_build_object('nombre', x.nombre, 'unidades', x.unidades)
  INTO v_top_hoy
  FROM (
    SELECT p.nombre, SUM(i.cantidad)::int AS unidades
    FROM public.ventas v
    JOIN public.ventas_items i ON i.venta_id = v.id
    JOIN public.productos p ON p.id = i.producto_id
    WHERE v.empresa_id = v_empresa
      AND v.deleted_at IS NULL
      AND (v.fecha AT TIME ZONE v_tz)::date = v_hoy
    GROUP BY p.nombre
    ORDER BY SUM(i.cantidad) DESC, p.nombre
    LIMIT 1
  ) x;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'fecha', d.dia,
    'dia', CASE extract(dow FROM d.dia)::int
      WHEN 0 THEN 'dom'
      WHEN 1 THEN 'lun'
      WHEN 2 THEN 'mar'
      WHEN 3 THEN 'mié'
      WHEN 4 THEN 'jue'
      WHEN 5 THEN 'vie'
      ELSE 'sáb'
    END,
    'total', COALESCE(s.total, 0)
  ) ORDER BY d.dia), '[]'::jsonb)
  INTO v_dias
  FROM generate_series((v_hoy - 6)::timestamp, v_hoy::timestamp, interval '1 day') AS d(dia)
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(t.total), 0) AS total
    FROM public.ventas v
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(i.precio_unitario * i.cantidad), 0) - COALESCE(v.descuento, 0) AS total
      FROM public.ventas_items i
      WHERE i.venta_id = v.id
    ) t ON TRUE
    WHERE v.empresa_id = v_empresa
      AND v.deleted_at IS NULL
      AND (v.fecha AT TIME ZONE v_tz)::date = d.dia::date
  ) s ON TRUE;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'nombre', y.nombre,
    'unidades', y.unidades
  ) ORDER BY y.unidades DESC, y.nombre), '[]'::jsonb)
  INTO v_top5
  FROM (
    SELECT p.nombre, SUM(i.cantidad)::int AS unidades
    FROM public.ventas v
    JOIN public.ventas_items i ON i.venta_id = v.id
    JOIN public.productos p ON p.id = i.producto_id
    WHERE v.empresa_id = v_empresa
      AND v.deleted_at IS NULL
    GROUP BY p.nombre
    ORDER BY SUM(i.cantidad) DESC, p.nombre
    LIMIT 5
  ) y;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'nombre', s.nombre,
    'stock', s.stock
  ) ORDER BY s.stock ASC, s.nombre), '[]'::jsonb)
  INTO v_stock
  FROM (
    SELECT
      p.nombre,
      COALESCE((
        SELECT SUM(m.cantidad * m.signo)::bigint
        FROM public.movimientos_inventario m
        WHERE m.producto_id = p.id
          AND m.empresa_id = v_empresa
          AND m.deleted_at IS NULL
      ), 0) AS stock
    FROM public.productos p
    WHERE p.empresa_id = v_empresa
      AND p.deleted_at IS NULL
      AND p.activo = (1 = 1)
  ) s;

  RETURN jsonb_build_object(
    'hoy', COALESCE(v_hoy_json, '{"cantidad":0,"total":0}'::jsonb),
    'semana', COALESCE(v_semana, 0),
    'mes', COALESCE(v_mes_total, 0),
    'top_hoy', v_top_hoy,
    'ultimos_7', COALESCE(v_dias, '[]'::jsonb),
    'top_5', COALESCE(v_top5, '[]'::jsonb),
    'stock', COALESCE(v_stock, '[]'::jsonb)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.dashboard_inicio() TO authenticated;

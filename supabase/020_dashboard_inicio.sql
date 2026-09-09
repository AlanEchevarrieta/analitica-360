-- Dashboard del inicio: una sola función con KPIs, gráficos, stock y cumpleaños.
-- Pegá TODO el archivo en el SQL Editor con rol postgres y dale Run.

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
  v_compras_mes numeric;
  v_top_hoy jsonb;
  v_dias jsonb;
  v_top5 jsonb;
  v_stock jsonb;
  v_cumples jsonb;
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
    'total', COALESCE(SUM(
      CASE
        WHEN COALESCE(v.total_con_interes, 0) > 0 THEN v.total_con_interes
        WHEN COALESCE(v.total_sin_interes, 0) > 0 THEN v.total_sin_interes
        ELSE t.total
      END
    ), 0)
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

  SELECT COALESCE(SUM(
    CASE
      WHEN COALESCE(v.total_con_interes, 0) > 0 THEN v.total_con_interes
      WHEN COALESCE(v.total_sin_interes, 0) > 0 THEN v.total_sin_interes
      ELSE t.total
    END
  ), 0)
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

  SELECT COALESCE(SUM(
    CASE
      WHEN COALESCE(v.total_con_interes, 0) > 0 THEN v.total_con_interes
      WHEN COALESCE(v.total_sin_interes, 0) > 0 THEN v.total_sin_interes
      ELSE t.total
    END
  ), 0)
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

  BEGIN
    SELECT COALESCE(SUM(c.total), 0)
    INTO v_compras_mes
    FROM public.compras c
    WHERE c.empresa_id = v_empresa
      AND c.deleted_at IS NULL
      AND c.fecha >= v_mes
      AND c.fecha <= v_hoy;
  EXCEPTION
    WHEN undefined_table THEN
      v_compras_mes := 0;
  END;

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
    SELECT COALESCE(SUM(
      CASE
        WHEN COALESCE(v.total_con_interes, 0) > 0 THEN v.total_con_interes
        WHEN COALESCE(v.total_sin_interes, 0) > 0 THEN v.total_sin_interes
        ELSE t.total
      END
    ), 0) AS total
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
      AND (v.fecha AT TIME ZONE v_tz)::date BETWEEN v_lunes AND v_hoy
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
      AND p.activo = TRUE
  ) s;

  BEGIN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', z.id,
      'nombre', z.nombre,
      'dia', z.dia,
      'mes', z.mes,
      'dias', z.dias
    ) ORDER BY z.dias, z.nombre), '[]'::jsonb)
    INTO v_cumples
    FROM (
      SELECT
        c.id,
        c.nombre,
        extract(day FROM c.cumpleanos)::int AS dia,
        extract(month FROM c.cumpleanos)::int AS mes,
        (gs.d::date - v_hoy) AS dias
      FROM public.clientes c
      JOIN generate_series(v_hoy::timestamp, (v_hoy + 7)::timestamp, interval '1 day') AS gs(d)
        ON to_char(c.cumpleanos, 'MM-DD') = to_char(gs.d, 'MM-DD')
      WHERE c.empresa_id = v_empresa
        AND c.deleted_at IS NULL
        AND c.cumpleanos IS NOT NULL
      ORDER BY (gs.d::date - v_hoy), c.nombre
      LIMIT 5
    ) z;
  EXCEPTION
    WHEN undefined_table THEN
      v_cumples := '[]'::jsonb;
  END;

  RETURN jsonb_build_object(
    'ventas_hoy', COALESCE(v_hoy_json, '{"cantidad":0,"total":0}'::jsonb),
    'hoy', COALESCE(v_hoy_json, '{"cantidad":0,"total":0}'::jsonb),
    'ventas_semana', COALESCE(v_semana, 0),
    'semana', COALESCE(v_semana, 0),
    'ventas_mes', COALESCE(v_mes_total, 0),
    'mes', COALESCE(v_mes_total, 0),
    'compras_mes', COALESCE(v_compras_mes, 0),
    'top_hoy', v_top_hoy,
    'top_productos', COALESCE(v_top5, '[]'::jsonb),
    'top_5', COALESCE(v_top5, '[]'::jsonb),
    'ventas_7dias', COALESCE(v_dias, '[]'::jsonb),
    'ultimos_7', COALESCE(v_dias, '[]'::jsonb),
    'stock', COALESCE(v_stock, '[]'::jsonb),
    'cumpleanos_proximos', COALESCE(v_cumples, '[]'::jsonb)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.dashboard_inicio() TO authenticated;

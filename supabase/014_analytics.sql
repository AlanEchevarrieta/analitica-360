-- Analytics por período. Pegá TODO el archivo en el SQL Editor y dale Run.

CREATE INDEX IF NOT EXISTS idx_ventas_empresa_fecha
  ON public.ventas(empresa_id, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_ventas_items_empresa_venta
  ON public.ventas_items(empresa_id, venta_id);

CREATE OR REPLACE FUNCTION public.analytics_periodo(p_desde date, p_hasta date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
  v_tz text := 'America/Argentina/Buenos_Aires';
  v_dias int;
  v_ant_desde date;
  v_ant_hasta date;
  v_total numeric;
  v_cant bigint;
  v_costo numeric;
  v_total_ant numeric;
  v_cant_ant bigint;
  v_costo_ant numeric;
  v_evo jsonb;
  v_pagos jsonb;
  v_top jsonb;
  v_tabla jsonb;
BEGIN
  v_empresa := public.get_empresa_id();
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;
  IF p_desde IS NULL OR p_hasta IS NULL OR p_hasta < p_desde THEN
    RAISE EXCEPTION 'PERIODO_INVALIDO';
  END IF;

  v_dias := (p_hasta - p_desde) + 1;
  v_ant_hasta := p_desde - 1;
  v_ant_desde := v_ant_hasta - v_dias + 1;

  SELECT
    COALESCE(SUM(t.total), 0),
    COUNT(v.id)::bigint,
    COALESCE(SUM(t.costo), 0)
  INTO v_total, v_cant, v_costo
  FROM public.ventas v
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(SUM(i.precio_unitario * i.cantidad), 0) - COALESCE(v.descuento, 0) AS total,
      COALESCE(SUM(i.costo_unitario * i.cantidad), 0) AS costo
    FROM public.ventas_items i
    WHERE i.venta_id = v.id
  ) t ON TRUE
  WHERE v.empresa_id = v_empresa
    AND v.deleted_at IS NULL
    AND (v.fecha AT TIME ZONE v_tz)::date BETWEEN p_desde AND p_hasta;

  SELECT
    COALESCE(SUM(t.total), 0),
    COUNT(v.id)::bigint,
    COALESCE(SUM(t.costo), 0)
  INTO v_total_ant, v_cant_ant, v_costo_ant
  FROM public.ventas v
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(SUM(i.precio_unitario * i.cantidad), 0) - COALESCE(v.descuento, 0) AS total,
      COALESCE(SUM(i.costo_unitario * i.cantidad), 0) AS costo
    FROM public.ventas_items i
    WHERE i.venta_id = v.id
  ) t ON TRUE
  WHERE v.empresa_id = v_empresa
    AND v.deleted_at IS NULL
    AND (v.fecha AT TIME ZONE v_tz)::date BETWEEN v_ant_desde AND v_ant_hasta;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'fecha', d.dia,
    'Ventas', COALESCE(s.total, 0)
  ) ORDER BY d.dia), '[]'::jsonb)
  INTO v_evo
  FROM generate_series(p_desde::timestamp, p_hasta::timestamp, interval '1 day') AS d(dia)
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
    'name', p.forma,
    'value', p.total
  ) ORDER BY p.total DESC), '[]'::jsonb)
  INTO v_pagos
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
      COALESCE(SUM(t.total), 0) AS total
    FROM public.ventas v
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(i.precio_unitario * i.cantidad), 0) - COALESCE(v.descuento, 0) AS total
      FROM public.ventas_items i
      WHERE i.venta_id = v.id
    ) t ON TRUE
    WHERE v.empresa_id = v_empresa
      AND v.deleted_at IS NULL
      AND (v.fecha AT TIME ZONE v_tz)::date BETWEEN p_desde AND p_hasta
    GROUP BY v.forma_pago
  ) p
  WHERE p.total > 0;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'nombre', z.nombre,
    'unidades', z.unidades
  ) ORDER BY z.unidades DESC, z.nombre), '[]'::jsonb)
  INTO v_top
  FROM (
    SELECT p.nombre, SUM(i.cantidad)::int AS unidades
    FROM public.ventas v
    JOIN public.ventas_items i ON i.venta_id = v.id
    JOIN public.productos p ON p.id = i.producto_id
    WHERE v.empresa_id = v_empresa
      AND v.deleted_at IS NULL
      AND (v.fecha AT TIME ZONE v_tz)::date BETWEEN p_desde AND p_hasta
    GROUP BY p.nombre
    ORDER BY SUM(i.cantidad) DESC, p.nombre
    LIMIT 10
  ) z;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'producto', r.nombre,
    'unidades', r.unidades,
    'total', r.total,
    'costo', r.costo,
    'margen', r.total - r.costo,
    'margen_pct', CASE WHEN r.total > 0 THEN round(((r.total - r.costo) / r.total) * 100, 1) ELSE 0 END
  ) ORDER BY r.total DESC, r.nombre), '[]'::jsonb)
  INTO v_tabla
  FROM (
    SELECT
      p.nombre,
      SUM(i.cantidad)::int AS unidades,
      SUM(i.precio_unitario * i.cantidad) AS total,
      SUM(i.costo_unitario * i.cantidad) AS costo
    FROM public.ventas v
    JOIN public.ventas_items i ON i.venta_id = v.id
    JOIN public.productos p ON p.id = i.producto_id
    WHERE v.empresa_id = v_empresa
      AND v.deleted_at IS NULL
      AND (v.fecha AT TIME ZONE v_tz)::date BETWEEN p_desde AND p_hasta
    GROUP BY p.nombre
  ) r;

  RETURN jsonb_build_object(
    'total', COALESCE(v_total, 0),
    'cantidad', COALESCE(v_cant, 0),
    'costo', COALESCE(v_costo, 0),
    'total_ant', COALESCE(v_total_ant, 0),
    'cantidad_ant', COALESCE(v_cant_ant, 0),
    'costo_ant', COALESCE(v_costo_ant, 0),
    'evolucion', COALESCE(v_evo, '[]'::jsonb),
    'formas_pago', COALESCE(v_pagos, '[]'::jsonb),
    'top_10', COALESCE(v_top, '[]'::jsonb),
    'productos', COALESCE(v_tabla, '[]'::jsonb)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.analytics_periodo(date, date) TO authenticated;

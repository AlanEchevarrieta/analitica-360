-- Inventario: umbral de stock, alertas en dashboard_inicio y tipos de ajuste.
-- SQL Editor, rol postgres. Pegá TODO y dale Run.

ALTER TABLE public.configuracion_empresa
  ADD COLUMN IF NOT EXISTS inventario JSONB DEFAULT '{"umbral_stock_bajo": 5}'::jsonb;

UPDATE public.configuracion_empresa
SET inventario = '{"umbral_stock_bajo": 5}'::jsonb
WHERE inventario IS NULL;

CREATE OR REPLACE FUNCTION public.ajustar_stock(
  p_producto_id uuid,
  p_tipo text,
  p_cantidad integer,
  p_motivo text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
  v_user uuid := auth.uid();
  v_signo smallint;
  v_rol text;
  v_permisos jsonb;
  v_tipo text;
BEGIN
  v_empresa := public.get_empresa_id();
  v_rol := public.get_rol();
  IF v_empresa IS NULL OR v_user IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;
  IF v_rol = 'dueno' THEN
    NULL;
  ELSIF v_rol = 'operador' THEN
    SELECT u.permisos INTO v_permisos
    FROM public.usuarios u
    WHERE u.id = v_user AND u.empresa_id = v_empresa AND u.deleted_at IS NULL;
    IF COALESCE((v_permisos->>'ajustar_stock')::boolean, FALSE) IS NOT TRUE THEN
      RAISE EXCEPTION 'NO_AUTORIZADO';
    END IF;
  ELSE
    RAISE EXCEPTION 'NO_AUTORIZADO';
  END IF;
  IF p_tipo NOT IN (
    'ajuste_positivo', 'ajuste_negativo', 'merma', 'rotura', 'perdida', 'consumo_interno'
  ) THEN
    RAISE EXCEPTION 'TIPO_INVALIDO';
  END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION 'CANTIDAD_INVALIDA';
  END IF;
  IF p_motivo IS NULL OR length(trim(p_motivo)) = 0 THEN
    RAISE EXCEPTION 'MOTIVO_OBLIGATORIO';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.productos p
    WHERE p.id = p_producto_id AND p.empresa_id = v_empresa AND p.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'PRODUCTO_INVALIDO';
  END IF;

  v_signo := CASE WHEN p_tipo = 'ajuste_positivo' THEN 1 ELSE -1 END;
  v_tipo := CASE WHEN p_tipo = 'ajuste_negativo' THEN 'ajuste_negativo' ELSE p_tipo END;

  INSERT INTO public.movimientos_inventario (
    empresa_id, producto_id, usuario_id, tipo, cantidad, signo, motivo
  ) VALUES (
    v_empresa, p_producto_id, v_user, v_tipo, p_cantidad, v_signo, trim(p_motivo)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.ajustar_stock(uuid, text, integer, text) TO authenticated;

-- Dashboard del inicio: una sola función con KPIs, gráficos, stock, cumpleaños y alertas.
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
  v_umbral integer := 5;
  v_alertas jsonb;
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
    SELECT COALESCE(NULLIF(c.inventario->>'umbral_stock_bajo', '')::int, 5)
    INTO v_umbral
    FROM public.configuracion_empresa c
    WHERE c.empresa_id = v_empresa;
  EXCEPTION
    WHEN undefined_column THEN
      v_umbral := 5;
    WHEN invalid_text_representation THEN
      v_umbral := 5;
  END;
  IF v_umbral IS NULL OR v_umbral < 0 THEN
    v_umbral := 5;
  END IF;

  SELECT COALESCE(jsonb_agg(elem ORDER BY (elem->>'stock')::numeric, elem->>'nombre'), '[]'::jsonb)
  INTO v_alertas
  FROM jsonb_array_elements(COALESCE(v_stock, '[]'::jsonb)) elem
  WHERE (elem->>'stock')::numeric <= v_umbral;

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
    'alertas_stock', COALESCE(v_alertas, '[]'::jsonb),
    'cumpleanos_proximos', COALESCE(v_cumples, '[]'::jsonb)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.dashboard_inicio() TO authenticated;

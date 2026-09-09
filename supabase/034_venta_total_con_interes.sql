-- El total cobrado de una venta en cuotas es total_con_interes, no la suma de ítems.
-- SQL Editor, rol postgres. Pegá TODO y dale Run.

CREATE OR REPLACE FUNCTION public.monto_venta(p_venta public.ventas)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path TO public
AS $$
  SELECT COALESCE(
    NULLIF(p_venta.total_con_interes, 0),
    NULLIF(p_venta.total_sin_interes, 0),
    (
      SELECT COALESCE(SUM(i.precio_unitario * i.cantidad), 0) - COALESCE(p_venta.descuento, 0)
      FROM public.ventas_items i
      WHERE i.venta_id = p_venta.id
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.monto_venta(public.ventas) TO authenticated;

DROP FUNCTION IF EXISTS public.confirmar_venta(jsonb, text, numeric, text);
DROP FUNCTION IF EXISTS public.confirmar_venta(jsonb, text, numeric, text, integer, numeric, numeric, numeric);
DROP FUNCTION IF EXISTS public.confirmar_venta(jsonb, text, numeric, text, integer, numeric, numeric, numeric, uuid);

CREATE OR REPLACE FUNCTION public.confirmar_venta(
  p_items jsonb,
  p_forma_pago text,
  p_descuento numeric,
  p_cliente text,
  p_cuotas integer DEFAULT 1,
  p_coeficiente_interes numeric DEFAULT 0,
  p_total_sin_interes numeric DEFAULT NULL,
  p_total_con_interes numeric DEFAULT NULL,
  p_cliente_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
  v_user uuid := auth.uid();
  v_venta uuid;
  v_item jsonb;
  v_producto uuid;
  v_cantidad integer;
  v_precio numeric;
  v_costo numeric;
  v_desc numeric;
  v_cuotas integer;
  v_coef numeric;
  v_nombre text;
  v_items_sum numeric := 0;
  v_sin numeric;
  v_con numeric;
BEGIN
  v_empresa := public.get_empresa_id();
  IF v_empresa IS NULL OR v_user IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;
  IF public.get_rol() NOT IN ('dueno', 'operador') THEN
    RAISE EXCEPTION 'NO_AUTORIZADO';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'SIN_PRODUCTOS';
  END IF;
  IF p_forma_pago NOT IN ('efectivo', 'transferencia', 'debito', 'credito', 'qr') THEN
    RAISE EXCEPTION 'FORMA_PAGO_INVALIDA';
  END IF;

  v_desc := COALESCE(p_descuento, 0);
  IF v_desc < 0 THEN
    RAISE EXCEPTION 'DESCUENTO_INVALIDO';
  END IF;
  v_cuotas := COALESCE(p_cuotas, 1);
  IF v_cuotas < 0 THEN
    RAISE EXCEPTION 'CUOTAS_INVALIDAS';
  END IF;
  v_coef := COALESCE(p_coeficiente_interes, 0);
  IF v_coef < 0 THEN
    RAISE EXCEPTION 'COEFICIENTE_INVALIDO';
  END IF;

  v_nombre := nullif(trim(coalesce(p_cliente, '')), '');
  IF p_cliente_id IS NOT NULL THEN
    SELECT c.nombre INTO v_nombre
    FROM public.clientes c
    WHERE c.id = p_cliente_id AND c.empresa_id = v_empresa AND c.deleted_at IS NULL;
    IF v_nombre IS NULL THEN
      RAISE EXCEPTION 'CLIENTE_INVALIDO';
    END IF;
  END IF;

  INSERT INTO public.ventas (
    empresa_id, usuario_id, forma_pago, descuento, cliente_nombre, cliente_id, canal,
    cuotas, coeficiente_interes, total_sin_interes, total_con_interes
  )
  VALUES (
    v_empresa,
    v_user,
    p_forma_pago,
    v_desc,
    v_nombre,
    p_cliente_id,
    'mostrador',
    v_cuotas,
    v_coef,
    p_total_sin_interes,
    p_total_con_interes
  )
  RETURNING id INTO v_venta;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_producto := (v_item->>'producto_id')::uuid;
    v_cantidad := (v_item->>'cantidad')::integer;
    v_precio := (v_item->>'precio_unitario')::numeric;

    IF v_producto IS NULL OR v_cantidad IS NULL OR v_cantidad <= 0 OR v_precio IS NULL OR v_precio < 0 THEN
      RAISE EXCEPTION 'ITEM_INVALIDO';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.productos p
      WHERE p.id = v_producto
        AND p.empresa_id = v_empresa
        AND p.activo = (1 = 1)
        AND p.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'PRODUCTO_INVALIDO';
    END IF;

    SELECT h.costo INTO v_costo
    FROM public.precios_historial h
    WHERE h.producto_id = v_producto AND h.empresa_id = v_empresa
    ORDER BY h.fecha_desde DESC, h.id DESC
    LIMIT 1;
    v_costo := COALESCE(v_costo, 0);
    v_items_sum := v_items_sum + (v_precio * v_cantidad);

    INSERT INTO public.ventas_items (
      venta_id, empresa_id, producto_id, cantidad, precio_unitario, costo_unitario
    ) VALUES (
      v_venta, v_empresa, v_producto, v_cantidad, v_precio, v_costo
    );

    INSERT INTO public.movimientos_inventario (
      empresa_id, producto_id, usuario_id, tipo, cantidad, signo,
      costo_unitario, precio_unitario, motivo, referencia_id
    ) VALUES (
      v_empresa, v_producto, v_user, 'venta', v_cantidad, -1,
      v_costo, v_precio, 'Venta', v_venta
    );
  END LOOP;

  v_sin := COALESCE(p_total_sin_interes, GREATEST(v_items_sum - v_desc, 0));
  IF p_forma_pago = 'credito' AND v_coef > 0 THEN
    v_con := COALESCE(NULLIF(p_total_con_interes, 0), round(v_sin * (1 + v_coef / 100.0), 2));
    IF v_con <= v_sin THEN
      v_con := round(v_sin * (1 + v_coef / 100.0), 2);
    END IF;
  ELSE
    v_con := COALESCE(NULLIF(p_total_con_interes, 0), v_sin);
  END IF;

  UPDATE public.ventas
  SET total_sin_interes = v_sin,
      total_con_interes = v_con
  WHERE id = v_venta;

  RETURN v_venta;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.confirmar_venta(jsonb, text, numeric, text, integer, numeric, numeric, numeric, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.resumen_ventas_hoy()
RETURNS TABLE (
  cantidad bigint,
  total numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
  v_hoy date;
BEGIN
  v_empresa := public.get_empresa_id();
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;

  v_hoy := (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;

  RETURN QUERY
  SELECT
    COUNT(v.id)::bigint,
    COALESCE(SUM(public.monto_venta(v)), 0)
  FROM public.ventas v
  WHERE v.empresa_id = v_empresa
    AND v.deleted_at IS NULL
    AND (v.fecha AT TIME ZONE 'America/Argentina/Buenos_Aires')::date = v_hoy;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.resumen_ventas_hoy() TO authenticated;

CREATE OR REPLACE FUNCTION public.listar_ventas_empresa()
RETURNS TABLE (
  id uuid,
  fecha timestamptz,
  productos text,
  total numeric,
  forma_pago text,
  cliente text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
BEGIN
  v_empresa := public.get_empresa_id();
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;

  RETURN QUERY
  SELECT
    v.id,
    v.fecha,
    COALESCE(
      (
        SELECT string_agg(p.nombre || ' × ' || i.cantidad::text, ', ' ORDER BY p.nombre)
        FROM public.ventas_items i
        JOIN public.productos p ON p.id = i.producto_id
        WHERE i.venta_id = v.id
      ),
      ''
    ),
    public.monto_venta(v),
    v.forma_pago,
    v.cliente_nombre
  FROM public.ventas v
  WHERE v.empresa_id = v_empresa
    AND v.deleted_at IS NULL
  ORDER BY v.fecha DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.listar_ventas_empresa() TO authenticated;

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
  v_cli jsonb;
  v_hay boolean;
  v_activos int;
  v_ticket numeric;
  v_top_nom text;
  v_top_tot numeric;
  v_nuevos int;
  v_rec int;
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
    COALESCE(SUM(public.monto_venta(v)), 0),
    COUNT(v.id)::bigint,
    COALESCE(SUM(t.costo), 0)
  INTO v_total, v_cant, v_costo
  FROM public.ventas v
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(i.costo_unitario * i.cantidad), 0) AS costo
    FROM public.ventas_items i
    WHERE i.venta_id = v.id
  ) t ON TRUE
  WHERE v.empresa_id = v_empresa
    AND v.deleted_at IS NULL
    AND (v.fecha AT TIME ZONE v_tz)::date BETWEEN p_desde AND p_hasta;

  SELECT
    COALESCE(SUM(public.monto_venta(v)), 0),
    COUNT(v.id)::bigint,
    COALESCE(SUM(t.costo), 0)
  INTO v_total_ant, v_cant_ant, v_costo_ant
  FROM public.ventas v
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(i.costo_unitario * i.cantidad), 0) AS costo
    FROM public.ventas_items i
    WHERE i.venta_id = v.id
  ) t ON TRUE
  WHERE v.empresa_id = v_empresa
    AND v.deleted_at IS NULL
    AND (v.fecha AT TIME ZONE v_tz)::date BETWEEN v_ant_desde AND v_ant_hasta;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'fecha', d.dia,
    'Ventas', COALESCE(s.total, 0),
    'Anterior', COALESCE(a.total, 0)
  ) ORDER BY d.dia), '[]'::jsonb)
  INTO v_evo
  FROM generate_series(p_desde::timestamp, p_hasta::timestamp, interval '1 day') AS d(dia)
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(public.monto_venta(v)), 0) AS total
    FROM public.ventas v
    WHERE v.empresa_id = v_empresa
      AND v.deleted_at IS NULL
      AND (v.fecha AT TIME ZONE v_tz)::date = d.dia::date
  ) s ON TRUE
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(public.monto_venta(v)), 0) AS total
    FROM public.ventas v
    WHERE v.empresa_id = v_empresa
      AND v.deleted_at IS NULL
      AND (v.fecha AT TIME ZONE v_tz)::date = (d.dia::date - v_dias)
  ) a ON TRUE;

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
      COALESCE(SUM(public.monto_venta(v)), 0) AS total
    FROM public.ventas v
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

  v_cli := '{"hay":false}'::jsonb;
  IF to_regclass('public.clientes') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.empresa_id = v_empresa AND c.deleted_at IS NULL
    ) INTO v_hay;

    IF v_hay THEN
      WITH matched AS (
        SELECT
          COALESCE(
            v.cliente_id,
            (
              SELECT c.id
              FROM public.clientes c
              WHERE c.empresa_id = v_empresa
                AND c.deleted_at IS NULL
                AND lower(trim(c.nombre)) = lower(trim(coalesce(v.cliente_nombre, '')))
              LIMIT 1
            )
          ) AS cid,
          public.monto_venta(v) AS total,
          (v.fecha AT TIME ZONE v_tz)::date AS dia
        FROM public.ventas v
        WHERE v.empresa_id = v_empresa
          AND v.deleted_at IS NULL
      ),
      periodo AS (
        SELECT cid, total FROM matched
        WHERE cid IS NOT NULL AND dia BETWEEN p_desde AND p_hasta
      ),
      spend AS (
        SELECT cid, SUM(total) AS gastado
        FROM periodo
        GROUP BY cid
      ),
      primera AS (
        SELECT cid, MIN(dia) AS primera
        FROM matched
        WHERE cid IS NOT NULL
        GROUP BY cid
      )
      SELECT
        COUNT(*)::int,
        COALESCE(SUM(s.gastado) / NULLIF(COUNT(*), 0), 0),
        MAX(c.nombre) FILTER (WHERE s.gastado = (SELECT MAX(gastado) FROM spend)),
        MAX(s.gastado),
        COUNT(*) FILTER (WHERE COALESCE(p.primera, p_desde) >= p_desde)::int,
        COUNT(*) FILTER (WHERE COALESCE(p.primera, p_desde) < p_desde)::int
      INTO v_activos, v_ticket, v_top_nom, v_top_tot, v_nuevos, v_rec
      FROM spend s
      JOIN public.clientes c ON c.id = s.cid
      LEFT JOIN primera p ON p.cid = s.cid;

      v_cli := jsonb_build_object(
        'hay', true,
        'activos', COALESCE(v_activos, 0),
        'ticket', COALESCE(v_ticket, 0),
        'top_nombre', COALESCE(v_top_nom, ''),
        'top_total', COALESCE(v_top_tot, 0),
        'pct_nuevos', CASE WHEN COALESCE(v_activos, 0) > 0
          THEN round((COALESCE(v_nuevos, 0)::numeric / v_activos) * 100, 0)
          ELSE 0 END,
        'pct_recurrentes', CASE WHEN COALESCE(v_activos, 0) > 0
          THEN round((COALESCE(v_rec, 0)::numeric / v_activos) * 100, 0)
          ELSE 0 END
      );
    END IF;
  END IF;

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
    'productos', COALESCE(v_tabla, '[]'::jsonb),
    'clientes', COALESCE(v_cli, '{"hay":false}'::jsonb)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.analytics_periodo(date, date) TO authenticated;

UPDATE public.ventas
SET total_con_interes = round(
  COALESCE(total_sin_interes, 0) * (1 + COALESCE(coeficiente_interes, 0) / 100.0),
  2
)
WHERE deleted_at IS NULL
  AND forma_pago = 'credito'
  AND COALESCE(coeficiente_interes, 0) > 0
  AND (
    total_con_interes IS NULL
    OR total_con_interes = 0
    OR total_con_interes <= COALESCE(total_sin_interes, 0)
  );

NOTIFY pgrst, 'reload schema';

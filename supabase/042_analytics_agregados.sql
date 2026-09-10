-- Día local de cada venta (Mendoza) para no perder filas por UTC.
-- SQL Editor, rol postgres. Pegá TODO y dale Run.

CREATE OR REPLACE FUNCTION public.dia_venta(p_fecha timestamptz)
RETURNS date
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT DATE(p_fecha AT TIME ZONE 'America/Argentina/Mendoza');
$$;

GRANT EXECUTE ON FUNCTION public.dia_venta(timestamptz) TO authenticated;

DROP FUNCTION IF EXISTS public.analytics_contar_ventas(date, date);
DROP FUNCTION IF EXISTS public.analytics_contar_ventas(date, date, uuid);
DROP FUNCTION IF EXISTS public.analytics_evolucion(date, date, text);
DROP FUNCTION IF EXISTS public.analytics_evolucion(date, date, text, uuid);
DROP FUNCTION IF EXISTS public.analytics_formas_pago(date, date);
DROP FUNCTION IF EXISTS public.analytics_formas_pago(date, date, uuid);
DROP FUNCTION IF EXISTS public.analytics_top_productos(date, date);
DROP FUNCTION IF EXISTS public.analytics_top_productos(date, date, uuid);
DROP FUNCTION IF EXISTS public.analytics_periodo(date, date);
DROP FUNCTION IF EXISTS public.analytics_periodo(date, date, uuid);
DROP FUNCTION IF EXISTS public.analytics_variantes(date, date);
DROP FUNCTION IF EXISTS public.analytics_variantes(date, date, uuid);

CREATE OR REPLACE FUNCTION public.analytics_resolver_empresa(p_empresa_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_auth uuid;
  v_empresa uuid;
BEGIN
  v_auth := public.get_empresa_id();
  v_empresa := COALESCE(p_empresa_id, v_auth);
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;
  IF v_auth IS NOT NULL AND v_empresa IS DISTINCT FROM v_auth THEN
    RAISE EXCEPTION 'NO_AUTORIZADO';
  END IF;
  RETURN v_empresa;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.analytics_resolver_empresa(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.analytics_contar_ventas(
  p_desde date,
  p_hasta date,
  p_empresa_id uuid DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
  v_cant bigint;
BEGIN
  v_empresa := public.analytics_resolver_empresa(p_empresa_id);
  IF p_desde IS NULL OR p_hasta IS NULL OR p_hasta < p_desde THEN
    RAISE EXCEPTION 'PERIODO_INVALIDO';
  END IF;

  SELECT COUNT(*)::bigint
  INTO v_cant
  FROM public.ventas v
  WHERE v.empresa_id = v_empresa
    AND v.deleted_at IS NULL
    AND public.dia_venta(v.fecha) BETWEEN p_desde::date AND p_hasta::date;

  RETURN COALESCE(v_cant, 0);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.analytics_contar_ventas(date, date, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.analytics_evolucion(
  p_desde date,
  p_hasta date,
  p_granularidad text DEFAULT 'semana',
  p_empresa_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
  v_unit text;
  v_dias int;
  v_ant_desde date;
  v_ant_hasta date;
  v_out jsonb;
BEGIN
  v_empresa := public.analytics_resolver_empresa(p_empresa_id);
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
        DATE_TRUNC(v_unit, public.dia_venta(v.fecha)::timestamp)::date AS periodo,
        SUM(public.monto_venta(v)) AS total,
        COUNT(*)::int AS cantidad
      FROM public.ventas v
      WHERE v.empresa_id = v_empresa
        AND v.deleted_at IS NULL
        AND public.dia_venta(v.fecha) BETWEEN p_desde::date AND p_hasta::date
      GROUP BY 1
    ) a
    FULL JOIN (
      SELECT
        DATE_TRUNC(v_unit, (public.dia_venta(v.fecha) + v_dias)::timestamp)::date AS periodo,
        SUM(public.monto_venta(v)) AS total
      FROM public.ventas v
      WHERE v.empresa_id = v_empresa
        AND v.deleted_at IS NULL
        AND public.dia_venta(v.fecha) BETWEEN v_ant_desde::date AND v_ant_hasta::date
      GROUP BY 1
    ) b ON b.periodo = a.periodo
  ) p
  WHERE p.periodo IS NOT NULL;

  RETURN COALESCE(v_out, '[]'::jsonb);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.analytics_evolucion(date, date, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.analytics_formas_pago(
  p_desde date,
  p_hasta date,
  p_empresa_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
  v_out jsonb;
BEGIN
  v_empresa := public.analytics_resolver_empresa(p_empresa_id);
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
      AND public.dia_venta(v.fecha) BETWEEN p_desde::date AND p_hasta::date
    GROUP BY v.forma_pago
  ) p
  WHERE p.total > 0;

  RETURN COALESCE(v_out, '[]'::jsonb);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.analytics_formas_pago(date, date, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.analytics_top_productos(
  p_desde date,
  p_hasta date,
  p_empresa_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
  v_out jsonb;
BEGIN
  v_empresa := public.analytics_resolver_empresa(p_empresa_id);
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
      AND public.dia_venta(v.fecha) BETWEEN p_desde::date AND p_hasta::date
    GROUP BY p.nombre
    ORDER BY SUM(vi.cantidad * vi.precio_unitario) DESC, p.nombre
    LIMIT 10
  ) z;

  RETURN COALESCE(v_out, '[]'::jsonb);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.analytics_top_productos(date, date, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.analytics_periodo(
  p_desde date,
  p_hasta date,
  p_empresa_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
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
  v_empresa := public.analytics_resolver_empresa(p_empresa_id);
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
    AND public.dia_venta(v.fecha) BETWEEN p_desde::date AND p_hasta::date;

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
    AND public.dia_venta(v.fecha) BETWEEN v_ant_desde::date AND v_ant_hasta::date;

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
      AND public.dia_venta(v.fecha) = d.dia::date
  ) s ON TRUE
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(public.monto_venta(v)), 0) AS total
    FROM public.ventas v
    WHERE v.empresa_id = v_empresa
      AND v.deleted_at IS NULL
      AND public.dia_venta(v.fecha) = (d.dia::date - v_dias)
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
      AND public.dia_venta(v.fecha) BETWEEN p_desde::date AND p_hasta::date
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
      AND public.dia_venta(v.fecha) BETWEEN p_desde::date AND p_hasta::date
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
      AND public.dia_venta(v.fecha) BETWEEN p_desde::date AND p_hasta::date
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
          public.dia_venta(v.fecha) AS dia
        FROM public.ventas v
        WHERE v.empresa_id = v_empresa
          AND v.deleted_at IS NULL
      ),
      periodo AS (
        SELECT cid, total FROM matched
        WHERE cid IS NOT NULL AND dia BETWEEN p_desde::date AND p_hasta::date
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

GRANT EXECUTE ON FUNCTION public.analytics_periodo(date, date, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.analytics_variantes(
  p_desde date,
  p_hasta date,
  p_empresa_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
  v_color jsonb;
  v_talle jsonb;
  v_combos jsonb;
  v_top_combo text;
  v_top_u numeric;
  v_total numeric;
BEGIN
  v_empresa := public.analytics_resolver_empresa(p_empresa_id);
  IF p_desde IS NULL OR p_hasta IS NULL OR p_hasta < p_desde THEN
    RAISE EXCEPTION 'PERIODO_INVALIDO';
  END IF;

  WITH base AS (
    SELECT
      p.nombre AS producto,
      i.cantidad,
      pv.atributos,
      (
        SELECT string_agg(x.v, '/' ORDER BY x.k)
        FROM jsonb_each_text(pv.atributos) AS x(k, v)
      ) AS combo
    FROM public.ventas v
    JOIN public.ventas_items i ON i.venta_id = v.id
    JOIN public.productos p ON p.id = i.producto_id
    JOIN public.producto_variantes pv ON pv.id = i.variante_id
    WHERE v.empresa_id = v_empresa
      AND v.deleted_at IS NULL
      AND i.variante_id IS NOT NULL
      AND public.dia_venta(v.fecha) BETWEEN p_desde::date AND p_hasta::date
  )
  SELECT
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', z.valor, 'unidades', z.u) ORDER BY z.u DESC, z.valor)
      FROM (
        SELECT j.v AS valor, SUM(b.cantidad) AS u
        FROM base b,
        LATERAL jsonb_each_text(b.atributos) AS j(k, v)
        WHERE lower(j.k) LIKE '%color%'
        GROUP BY j.v
      ) z
    ), '[]'::jsonb),
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', z.valor, 'unidades', z.u) ORDER BY z.u DESC, z.valor)
      FROM (
        SELECT j.v AS valor, SUM(b.cantidad) AS u
        FROM base b,
        LATERAL jsonb_each_text(b.atributos) AS j(k, v)
        WHERE lower(j.k) LIKE '%talle%'
           OR lower(j.k) LIKE '%tamaño%'
           OR lower(j.k) LIKE '%tamano%'
        GROUP BY j.v
      ) z
    ), '[]'::jsonb),
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'producto', z.producto,
        'combo', z.combo,
        'unidades', z.u
      ) ORDER BY z.u DESC, z.producto)
      FROM (
        SELECT producto, combo, SUM(cantidad) AS u
        FROM base
        WHERE combo IS NOT NULL AND combo <> ''
        GROUP BY producto, combo
      ) z
    ), '[]'::jsonb),
    COALESCE((SELECT SUM(cantidad) FROM base), 0)
  INTO v_color, v_talle, v_combos, v_total;

  SELECT z.combo, z.u
  INTO v_top_combo, v_top_u
  FROM (
    SELECT combo, SUM(cantidad) AS u
    FROM (
      SELECT
        i.cantidad,
        (
          SELECT string_agg(x.v, '/' ORDER BY x.k)
          FROM jsonb_each_text(pv.atributos) AS x(k, v)
        ) AS combo
      FROM public.ventas v
      JOIN public.ventas_items i ON i.venta_id = v.id
      JOIN public.producto_variantes pv ON pv.id = i.variante_id
      WHERE v.empresa_id = v_empresa
        AND v.deleted_at IS NULL
        AND i.variante_id IS NOT NULL
        AND public.dia_venta(v.fecha) BETWEEN p_desde::date AND p_hasta::date
    ) t
    WHERE combo IS NOT NULL AND combo <> ''
    GROUP BY combo
    ORDER BY SUM(cantidad) DESC
    LIMIT 1
  ) z;

  RETURN jsonb_build_object(
    'por_color', COALESCE(v_color, '[]'::jsonb),
    'por_talle', COALESCE(v_talle, '[]'::jsonb),
    'combinaciones', COALESCE(v_combos, '[]'::jsonb),
    'insight_combo', COALESCE(v_top_combo, ''),
    'insight_pct', CASE WHEN COALESCE(v_total, 0) > 0 AND v_top_u IS NOT NULL
      THEN round((v_top_u / v_total) * 100, 0)
      ELSE 0 END
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.analytics_variantes(date, date, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Módulo Compras.
--
-- IMPORTANTE: en el SQL Editor, arriba o abajo, el rol tiene que ser
-- "postgres" (dueño de la base). Si corre como "authenticated" o "anon"
-- aparece: permission denied for schema public.
-- Pegá TODO el archivo y dale Run.

CREATE TABLE IF NOT EXISTS public.compras (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID NOT NULL REFERENCES public.empresas(id),
  usuario_id  UUID REFERENCES public.usuarios(id),
  proveedor   TEXT,
  fecha       DATE NOT NULL DEFAULT CURRENT_DATE,
  total       NUMERIC(12,2),
  notas       TEXT,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.compras_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id       UUID NOT NULL REFERENCES public.compras(id),
  empresa_id      UUID NOT NULL REFERENCES public.empresas(id),
  producto_id     UUID REFERENCES public.productos(id),
  producto_nombre TEXT NOT NULL,
  cantidad        INT NOT NULL CHECK (cantidad > 0),
  costo_unitario  NUMERIC(12,2) NOT NULL CHECK (costo_unitario >= 0),
  subtotal        NUMERIC(12,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_compras_empresa
  ON public.compras(empresa_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_compras_items_compra
  ON public.compras_items(compra_id);

ALTER TABLE public.compras_items
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);

UPDATE public.compras_items i
SET empresa_id = c.empresa_id
FROM public.compras c
WHERE i.compra_id = c.id
  AND i.empresa_id IS NULL;

ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras_items ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.compras TO authenticated;
GRANT SELECT, INSERT ON public.compras_items TO authenticated;

DROP POLICY IF EXISTS "empresa_propia" ON public.compras;
DROP POLICY IF EXISTS compras_select ON public.compras;
CREATE POLICY compras_select ON public.compras
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_empresa_id() AND deleted_at IS NULL);

DROP POLICY IF EXISTS compras_insert ON public.compras;
CREATE POLICY compras_insert ON public.compras
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.get_empresa_id()
    AND public.get_rol() IN ('dueno', 'operador')
  );

DROP POLICY IF EXISTS compras_items_select ON public.compras_items;
CREATE POLICY compras_items_select ON public.compras_items
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_empresa_id());

DROP POLICY IF EXISTS compras_items_insert ON public.compras_items;
CREATE POLICY compras_items_insert ON public.compras_items
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.get_empresa_id()
    AND public.get_rol() IN ('dueno', 'operador')
  );

DROP FUNCTION IF EXISTS public.listar_compras_empresa();

CREATE OR REPLACE FUNCTION public.listar_compras_empresa()
RETURNS TABLE (
  id uuid,
  fecha date,
  proveedor text,
  productos text,
  total numeric,
  notas text
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
    c.id::uuid,
    c.fecha::date,
    c.proveedor::text,
    COALESCE(
      (
        SELECT string_agg(i.producto_nombre || ' × ' || i.cantidad::text, ', ' ORDER BY i.producto_nombre)
        FROM public.compras_items i
        WHERE i.compra_id = c.id
      ),
      ''
    )::text,
    COALESCE(c.total, 0)::numeric,
    c.notas::text
  FROM public.compras c
  WHERE c.empresa_id = v_empresa
    AND c.deleted_at IS NULL
  ORDER BY c.fecha DESC NULLS LAST, c.created_at DESC NULLS LAST;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.listar_compras_empresa() TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_compras_empresa() TO service_role;

CREATE OR REPLACE FUNCTION public.confirmar_compra(
  p_items jsonb,
  p_proveedor text,
  p_fecha date,
  p_notas text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
  v_user uuid := auth.uid();
  v_compra uuid;
  v_item jsonb;
  v_producto uuid;
  v_nombre text;
  v_cantidad integer;
  v_costo numeric;
  v_subtotal numeric;
  v_total numeric := 0;
  v_precio numeric;
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
  IF p_fecha IS NULL THEN
    RAISE EXCEPTION 'FECHA_INVALIDA';
  END IF;

  INSERT INTO public.compras (
    empresa_id, usuario_id, proveedor, fecha, total, notas
  ) VALUES (
    v_empresa,
    v_user,
    nullif(trim(coalesce(p_proveedor, '')), ''),
    p_fecha,
    0,
    nullif(trim(coalesce(p_notas, '')), '')
  )
  RETURNING id INTO v_compra;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_producto := (v_item->>'producto_id')::uuid;
    v_nombre := trim(coalesce(v_item->>'producto_nombre', ''));
    v_cantidad := (v_item->>'cantidad')::integer;
    v_costo := (v_item->>'costo_unitario')::numeric;

    IF v_producto IS NULL OR v_cantidad IS NULL OR v_cantidad <= 0 OR v_costo IS NULL OR v_costo < 0 THEN
      RAISE EXCEPTION 'ITEM_INVALIDO';
    END IF;

    SELECT p.nombre INTO v_nombre
    FROM public.productos p
    WHERE p.id = v_producto
      AND p.empresa_id = v_empresa
      AND p.deleted_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'PRODUCTO_INVALIDO';
    END IF;

    v_subtotal := round(v_cantidad * v_costo, 2);
    v_total := v_total + v_subtotal;

    INSERT INTO public.compras_items (
      compra_id, empresa_id, producto_id, producto_nombre, cantidad, costo_unitario, subtotal
    ) VALUES (
      v_compra, v_empresa, v_producto, v_nombre, v_cantidad, v_costo, v_subtotal
    );

    INSERT INTO public.movimientos_inventario (
      empresa_id, producto_id, usuario_id, tipo, cantidad, signo,
      costo_unitario, motivo, referencia_id
    ) VALUES (
      v_empresa, v_producto, v_user, 'compra', v_cantidad, 1,
      v_costo, 'Compra', v_compra
    );

    SELECT h.precio_venta INTO v_precio
    FROM public.precios_historial h
    WHERE h.producto_id = v_producto AND h.empresa_id = v_empresa
    ORDER BY h.fecha_desde DESC, h.id DESC
    LIMIT 1;
    v_precio := COALESCE(v_precio, 0);

    INSERT INTO public.precios_historial (empresa_id, producto_id, precio_venta, costo, fecha_desde)
    VALUES (v_empresa, v_producto, v_precio, v_costo, p_fecha);
  END LOOP;

  UPDATE public.compras
  SET total = v_total
  WHERE id = v_compra;

  RETURN v_compra;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.confirmar_compra(jsonb, text, date, text) TO authenticated;

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

  SELECT COALESCE(SUM(c.total), 0)
  INTO v_compras_mes
  FROM public.compras c
  WHERE c.empresa_id = v_empresa
    AND c.deleted_at IS NULL
    AND c.fecha >= v_mes
    AND c.fecha <= v_hoy;

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
    'compras_mes', COALESCE(v_compras_mes, 0),
    'top_hoy', v_top_hoy,
    'ultimos_7', COALESCE(v_dias, '[]'::jsonb),
    'top_5', COALESCE(v_top5, '[]'::jsonb),
    'stock', COALESCE(v_stock, '[]'::jsonb)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.dashboard_inicio() TO authenticated;

NOTIFY pgrst, 'reload schema';

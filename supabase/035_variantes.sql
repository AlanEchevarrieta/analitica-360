-- Variantes de productos (opt-in por empresa: usa_variantes = FALSE por defecto).
-- SQL Editor, rol postgres. Pegá TODO y dale Run.
-- RLS con get_empresa_id() (usuarios.id = auth.uid(), no existe auth_id).

ALTER TABLE public.configuracion_empresa
  ADD COLUMN IF NOT EXISTS usa_variantes BOOLEAN DEFAULT FALSE;

UPDATE public.configuracion_empresa
SET usa_variantes = FALSE
WHERE usa_variantes IS NULL;

CREATE TABLE IF NOT EXISTS public.atributos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  nombre TEXT NOT NULL,
  valores TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.atributos ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.atributos TO authenticated;

DROP POLICY IF EXISTS "empresa_propia" ON public.atributos;
DROP POLICY IF EXISTS atributos_empresa ON public.atributos;
CREATE POLICY atributos_empresa ON public.atributos
  FOR ALL TO authenticated
  USING (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

CREATE TABLE IF NOT EXISTS public.producto_variantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id UUID NOT NULL REFERENCES public.productos(id),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  sku TEXT,
  atributos JSONB NOT NULL DEFAULT '{}',
  precio_venta NUMERIC(12,2),
  costo NUMERIC(12,2),
  activo BOOLEAN DEFAULT TRUE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.producto_variantes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.producto_variantes TO authenticated;

DROP POLICY IF EXISTS "empresa_propia" ON public.producto_variantes;
DROP POLICY IF EXISTS variantes_empresa ON public.producto_variantes;
CREATE POLICY variantes_empresa ON public.producto_variantes
  FOR ALL TO authenticated
  USING (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

ALTER TABLE public.movimientos_inventario
  ADD COLUMN IF NOT EXISTS variante_id UUID REFERENCES public.producto_variantes(id);

ALTER TABLE public.ventas_items
  ADD COLUMN IF NOT EXISTS variante_id UUID REFERENCES public.producto_variantes(id);

CREATE INDEX IF NOT EXISTS idx_variantes_producto
  ON public.producto_variantes(producto_id, empresa_id);

CREATE INDEX IF NOT EXISTS idx_atributos_empresa
  ON public.atributos(empresa_id);

CREATE INDEX IF NOT EXISTS idx_mov_variante
  ON public.movimientos_inventario(variante_id)
  WHERE variante_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_items_variante
  ON public.ventas_items(variante_id)
  WHERE variante_id IS NOT NULL;

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
  v_variante uuid;
  v_costo_var numeric;
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
    v_variante := NULLIF(v_item->>'variante_id', '')::uuid;

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

    IF v_variante IS NOT NULL THEN
      SELECT pv.costo INTO v_costo_var
      FROM public.producto_variantes pv
      WHERE pv.id = v_variante
        AND pv.producto_id = v_producto
        AND pv.empresa_id = v_empresa
        AND pv.deleted_at IS NULL
        AND pv.activo = TRUE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'VARIANTE_INVALIDA';
      END IF;
    ELSE
      v_costo_var := NULL;
    END IF;

    SELECT h.costo INTO v_costo
    FROM public.precios_historial h
    WHERE h.producto_id = v_producto AND h.empresa_id = v_empresa
    ORDER BY h.fecha_desde DESC, h.id DESC
    LIMIT 1;
    v_costo := COALESCE(v_costo_var, v_costo, 0);
    v_items_sum := v_items_sum + (v_precio * v_cantidad);

    INSERT INTO public.ventas_items (
      venta_id, empresa_id, producto_id, cantidad, precio_unitario, costo_unitario, variante_id
    ) VALUES (
      v_venta, v_empresa, v_producto, v_cantidad, v_precio, v_costo, v_variante
    );

    INSERT INTO public.movimientos_inventario (
      empresa_id, producto_id, usuario_id, tipo, cantidad, signo,
      costo_unitario, precio_unitario, motivo, referencia_id, variante_id
    ) VALUES (
      v_empresa, v_producto, v_user, 'venta', v_cantidad, -1,
      v_costo, v_precio, 'Venta', v_venta, v_variante
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

CREATE OR REPLACE FUNCTION public.analytics_variantes(p_desde date, p_hasta date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
  v_tz text := 'America/Argentina/Buenos_Aires';
  v_color jsonb;
  v_talle jsonb;
  v_combos jsonb;
  v_top_combo text;
  v_top_u numeric;
  v_total numeric;
BEGIN
  v_empresa := public.get_empresa_id();
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;
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
      AND (v.fecha AT TIME ZONE v_tz)::date BETWEEN p_desde AND p_hasta
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
        AND (v.fecha AT TIME ZONE v_tz)::date BETWEEN p_desde AND p_hasta
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

GRANT EXECUTE ON FUNCTION public.analytics_variantes(date, date) TO authenticated;

NOTIFY pgrst, 'reload schema';

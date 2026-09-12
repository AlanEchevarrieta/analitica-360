-- Lotes y vencimientos.
-- SQL Editor, rol postgres. Pegá TODO y dale Run.

CREATE TABLE IF NOT EXISTS public.lotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  producto_id UUID NOT NULL REFERENCES public.productos(id),
  variante_id UUID REFERENCES public.producto_variantes(id),
  numero_lote TEXT NOT NULL,
  fecha_vencimiento DATE,
  fecha_elaboracion DATE,
  cantidad_inicial NUMERIC(12,2) NOT NULL DEFAULT 0,
  proveedor_id UUID REFERENCES public.proveedores(id),
  notas TEXT,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.lotes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lotes TO authenticated;

DROP POLICY IF EXISTS "empresa_propia" ON public.lotes;
DROP POLICY IF EXISTS lotes_empresa ON public.lotes;
CREATE POLICY lotes_empresa ON public.lotes
  FOR ALL TO authenticated
  USING (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

ALTER TABLE public.movimientos_inventario
  ADD COLUMN IF NOT EXISTS lote_id UUID REFERENCES public.lotes(id);

ALTER TABLE public.ventas_items
  ADD COLUMN IF NOT EXISTS lote_id UUID REFERENCES public.lotes(id);

ALTER TABLE public.compras_items
  ADD COLUMN IF NOT EXISTS lote_id UUID REFERENCES public.lotes(id);

ALTER TABLE public.configuracion_empresa
  ADD COLUMN IF NOT EXISTS usa_lotes BOOLEAN DEFAULT FALSE;

UPDATE public.configuracion_empresa
SET usa_lotes = FALSE
WHERE usa_lotes IS NULL;

CREATE INDEX IF NOT EXISTS idx_lotes_producto
  ON public.lotes(producto_id, empresa_id);

CREATE INDEX IF NOT EXISTS idx_lotes_vencimiento
  ON public.lotes(empresa_id, fecha_vencimiento)
  WHERE fecha_vencimiento IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mov_lote
  ON public.movimientos_inventario(lote_id)
  WHERE lote_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.confirmar_compra(
  p_items jsonb,
  p_proveedor text,
  p_fecha date,
  p_notas text,
  p_proveedor_id uuid DEFAULT NULL
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
  v_prov_id uuid;
  v_prov_nombre text;
  v_variante uuid;
  v_lote uuid;
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

  v_prov_nombre := nullif(trim(coalesce(p_proveedor, '')), '');
  v_prov_id := p_proveedor_id;
  IF v_prov_id IS NOT NULL THEN
    SELECT pr.nombre INTO v_prov_nombre
    FROM public.proveedores pr
    WHERE pr.id = v_prov_id AND pr.empresa_id = v_empresa AND pr.deleted_at IS NULL;
    IF v_prov_nombre IS NULL THEN
      RAISE EXCEPTION 'PROVEEDOR_INVALIDO';
    END IF;
  END IF;

  INSERT INTO public.compras (
    empresa_id, usuario_id, proveedor, proveedor_id, fecha, total, notas
  ) VALUES (
    v_empresa, v_user, v_prov_nombre, v_prov_id, p_fecha, 0,
    nullif(trim(coalesce(p_notas, '')), '')
  )
  RETURNING id INTO v_compra;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_producto := (v_item->>'producto_id')::uuid;
    v_nombre := trim(coalesce(v_item->>'producto_nombre', ''));
    v_cantidad := (v_item->>'cantidad')::integer;
    v_costo := (v_item->>'costo_unitario')::numeric;
    v_variante := NULLIF(v_item->>'variante_id', '')::uuid;
    v_lote := NULLIF(v_item->>'lote_id', '')::uuid;

    IF v_producto IS NULL OR v_cantidad IS NULL OR v_cantidad <= 0 OR v_costo IS NULL OR v_costo < 0 THEN
      RAISE EXCEPTION 'ITEM_INVALIDO';
    END IF;

    SELECT p.nombre INTO v_nombre
    FROM public.productos p
    WHERE p.id = v_producto AND p.empresa_id = v_empresa AND p.deleted_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'PRODUCTO_INVALIDO';
    END IF;

    IF v_variante IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.producto_variantes pv
        WHERE pv.id = v_variante AND pv.producto_id = v_producto
          AND pv.empresa_id = v_empresa AND pv.deleted_at IS NULL
      ) THEN
        RAISE EXCEPTION 'VARIANTE_INVALIDA';
      END IF;
    END IF;

    IF v_lote IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.lotes l
        WHERE l.id = v_lote AND l.empresa_id = v_empresa AND l.producto_id = v_producto
      ) THEN
        RAISE EXCEPTION 'LOTE_INVALIDO';
      END IF;
    END IF;

    v_subtotal := round(v_cantidad * v_costo, 2);
    v_total := v_total + v_subtotal;

    INSERT INTO public.compras_items (
      compra_id, empresa_id, producto_id, producto_nombre, cantidad, costo_unitario, subtotal, variante_id, lote_id
    ) VALUES (
      v_compra, v_empresa, v_producto, v_nombre, v_cantidad, v_costo, v_subtotal, v_variante, v_lote
    );

    INSERT INTO public.movimientos_inventario (
      empresa_id, producto_id, usuario_id, tipo, cantidad, signo,
      costo_unitario, motivo, referencia_id, variante_id, lote_id
    ) VALUES (
      v_empresa, v_producto, v_user, 'compra', v_cantidad, 1,
      v_costo, 'Compra', v_compra, v_variante, v_lote
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

  UPDATE public.compras SET total = v_total WHERE id = v_compra;
  RETURN v_compra;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.confirmar_compra(jsonb, text, date, text, uuid) TO authenticated;

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
  v_lote uuid;
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
  IF v_desc < 0 THEN RAISE EXCEPTION 'DESCUENTO_INVALIDO'; END IF;
  v_cuotas := COALESCE(p_cuotas, 1);
  IF v_cuotas < 0 THEN RAISE EXCEPTION 'CUOTAS_INVALIDAS'; END IF;
  v_coef := COALESCE(p_coeficiente_interes, 0);
  IF v_coef < 0 THEN RAISE EXCEPTION 'COEFICIENTE_INVALIDO'; END IF;

  v_nombre := nullif(trim(coalesce(p_cliente, '')), '');
  IF p_cliente_id IS NOT NULL THEN
    SELECT c.nombre INTO v_nombre
    FROM public.clientes c
    WHERE c.id = p_cliente_id AND c.empresa_id = v_empresa AND c.deleted_at IS NULL;
    IF v_nombre IS NULL THEN RAISE EXCEPTION 'CLIENTE_INVALIDO'; END IF;
  END IF;

  INSERT INTO public.ventas (
    empresa_id, usuario_id, forma_pago, descuento, cliente_nombre, cliente_id, canal,
    cuotas, coeficiente_interes, total_sin_interes, total_con_interes
  ) VALUES (
    v_empresa, v_user, p_forma_pago, v_desc, v_nombre, p_cliente_id, 'mostrador',
    v_cuotas, v_coef, p_total_sin_interes, p_total_con_interes
  )
  RETURNING id INTO v_venta;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_producto := (v_item->>'producto_id')::uuid;
    v_cantidad := (v_item->>'cantidad')::integer;
    v_precio := (v_item->>'precio_unitario')::numeric;
    v_variante := NULLIF(v_item->>'variante_id', '')::uuid;
    v_lote := NULLIF(v_item->>'lote_id', '')::uuid;

    IF v_producto IS NULL OR v_cantidad IS NULL OR v_cantidad <= 0 OR v_precio IS NULL OR v_precio < 0 THEN
      RAISE EXCEPTION 'ITEM_INVALIDO';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.productos
      WHERE id = v_producto AND empresa_id = v_empresa AND deleted_at IS NULL AND activo = TRUE
    ) THEN
      RAISE EXCEPTION 'PRODUCTO_INVALIDO';
    END IF;

    IF v_variante IS NOT NULL THEN
      SELECT pv.costo INTO v_costo_var
      FROM public.producto_variantes pv
      WHERE pv.id = v_variante AND pv.producto_id = v_producto
        AND pv.empresa_id = v_empresa AND pv.deleted_at IS NULL AND pv.activo = TRUE;
      IF NOT FOUND THEN RAISE EXCEPTION 'VARIANTE_INVALIDA'; END IF;
    ELSE
      v_costo_var := NULL;
    END IF;

    IF v_lote IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.lotes l
        WHERE l.id = v_lote AND l.empresa_id = v_empresa AND l.producto_id = v_producto
      ) THEN
        RAISE EXCEPTION 'LOTE_INVALIDO';
      END IF;
    END IF;

    SELECT h.costo INTO v_costo
    FROM public.precios_historial h
    WHERE h.producto_id = v_producto AND h.empresa_id = v_empresa
    ORDER BY h.fecha_desde DESC, h.id DESC
    LIMIT 1;
    v_costo := COALESCE(v_costo_var, v_costo, 0);
    v_items_sum := v_items_sum + (v_precio * v_cantidad);

    INSERT INTO public.ventas_items (
      venta_id, empresa_id, producto_id, cantidad, precio_unitario, costo_unitario, variante_id, lote_id
    ) VALUES (
      v_venta, v_empresa, v_producto, v_cantidad, v_precio, v_costo, v_variante, v_lote
    );

    INSERT INTO public.movimientos_inventario (
      empresa_id, producto_id, usuario_id, tipo, cantidad, signo,
      costo_unitario, precio_unitario, motivo, referencia_id, variante_id, lote_id
    ) VALUES (
      v_empresa, v_producto, v_user, 'venta', v_cantidad, -1,
      v_costo, v_precio, 'Venta', v_venta, v_variante, v_lote
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
  SET total_sin_interes = v_sin, total_con_interes = v_con
  WHERE id = v_venta;
  RETURN v_venta;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.confirmar_venta(jsonb, text, numeric, text, integer, numeric, numeric, numeric, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

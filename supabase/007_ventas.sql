-- Módulo Ventas (encabezado + ítems + kardex).
-- Pegá TODO el archivo en el SQL Editor y dale Run. No pisa el SQL de productos.

ALTER TABLE public.movimientos_inventario
  ADD COLUMN IF NOT EXISTS referencia_id UUID;

CREATE TABLE IF NOT EXISTS public.ventas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID NOT NULL REFERENCES public.empresas(id),
  usuario_id      UUID NOT NULL REFERENCES public.usuarios(id),
  fecha           TIMESTAMPTZ NOT NULL DEFAULT now(),
  forma_pago      TEXT NOT NULL,
  descuento       NUMERIC(12,2) NOT NULL DEFAULT 0,
  cliente_nombre  TEXT,
  canal           TEXT DEFAULT 'mostrador',
  notas           TEXT,
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ventas_empresa_fecha
  ON public.ventas(empresa_id, fecha DESC);

ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS cliente_nombre TEXT;

CREATE TABLE IF NOT EXISTS public.ventas_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id        UUID NOT NULL REFERENCES public.ventas(id),
  empresa_id      UUID NOT NULL REFERENCES public.empresas(id),
  producto_id     UUID NOT NULL REFERENCES public.productos(id),
  cantidad        INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(12,2) NOT NULL,
  costo_unitario  NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_ventas_items_venta ON public.ventas_items(venta_id);
CREATE INDEX IF NOT EXISTS idx_ventas_items_empresa ON public.ventas_items(empresa_id);

ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas_items ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.ventas TO authenticated;
GRANT SELECT, INSERT ON public.ventas_items TO authenticated;

DROP POLICY IF EXISTS ventas_select ON public.ventas;
CREATE POLICY ventas_select ON public.ventas
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_empresa_id() AND deleted_at IS NULL);

DROP POLICY IF EXISTS ventas_insert ON public.ventas;
CREATE POLICY ventas_insert ON public.ventas
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.get_empresa_id()
    AND public.get_rol() IN ('dueno', 'operador')
  );

DROP POLICY IF EXISTS ventas_items_select ON public.ventas_items;
CREATE POLICY ventas_items_select ON public.ventas_items
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_empresa_id());

DROP POLICY IF EXISTS ventas_items_insert ON public.ventas_items;
CREATE POLICY ventas_items_insert ON public.ventas_items
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.get_empresa_id()
    AND public.get_rol() IN ('dueno', 'operador')
  );

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
    COALESCE(
      (
        SELECT SUM(i.precio_unitario * i.cantidad)
        FROM public.ventas_items i
        WHERE i.venta_id = v.id
      ),
      0
    ) - COALESCE(v.descuento, 0),
    v.forma_pago,
    v.cliente_nombre
  FROM public.ventas v
  WHERE v.empresa_id = v_empresa
    AND v.deleted_at IS NULL
  ORDER BY v.fecha DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.listar_ventas_empresa() TO authenticated;

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
    COALESCE(SUM(t.total), 0)
  FROM public.ventas v
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(SUM(i.precio_unitario * i.cantidad), 0) - COALESCE(v.descuento, 0) AS total
    FROM public.ventas_items i
    WHERE i.venta_id = v.id
  ) t ON TRUE
  WHERE v.empresa_id = v_empresa
    AND v.deleted_at IS NULL
    AND (v.fecha AT TIME ZONE 'America/Argentina/Buenos_Aires')::date = v_hoy;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.resumen_ventas_hoy() TO authenticated;

CREATE OR REPLACE FUNCTION public.confirmar_venta(
  p_items jsonb,
  p_forma_pago text,
  p_descuento numeric,
  p_cliente text
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

  INSERT INTO public.ventas (empresa_id, usuario_id, forma_pago, descuento, cliente_nombre, canal)
  VALUES (
    v_empresa,
    v_user,
    p_forma_pago,
    v_desc,
    nullif(trim(coalesce(p_cliente, '')), ''),
    'mostrador'
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

  RETURN v_venta;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.confirmar_venta(jsonb, text, numeric, text) TO authenticated;

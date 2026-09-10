-- Variantes en compras + atributo activo en ventas + dimensiones de producto.
-- SQL Editor, rol postgres. Pegá TODO y dale Run.

ALTER TABLE public.atributos
  ADD COLUMN IF NOT EXISTS activo_ventas BOOLEAN DEFAULT TRUE;

UPDATE public.atributos
SET activo_ventas = TRUE
WHERE activo_ventas IS NULL;

ALTER TABLE public.compras_items
  ADD COLUMN IF NOT EXISTS variante_id UUID REFERENCES public.producto_variantes(id);

ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS alto_cm NUMERIC(8,2);
ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS largo_cm NUMERIC(8,2);
ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS ancho_cm NUMERIC(8,2);
ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS peso_gr NUMERIC(10,2);

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
    v_empresa,
    v_user,
    v_prov_nombre,
    v_prov_id,
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
    v_variante := NULLIF(v_item->>'variante_id', '')::uuid;

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

    IF v_variante IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.producto_variantes pv
        WHERE pv.id = v_variante
          AND pv.producto_id = v_producto
          AND pv.empresa_id = v_empresa
          AND pv.deleted_at IS NULL
      ) THEN
        RAISE EXCEPTION 'VARIANTE_INVALIDA';
      END IF;
    END IF;

    v_subtotal := round(v_cantidad * v_costo, 2);
    v_total := v_total + v_subtotal;

    INSERT INTO public.compras_items (
      compra_id, empresa_id, producto_id, producto_nombre, cantidad, costo_unitario, subtotal, variante_id
    ) VALUES (
      v_compra, v_empresa, v_producto, v_nombre, v_cantidad, v_costo, v_subtotal, v_variante
    );

    INSERT INTO public.movimientos_inventario (
      empresa_id, producto_id, usuario_id, tipo, cantidad, signo,
      costo_unitario, motivo, referencia_id, variante_id
    ) VALUES (
      v_empresa, v_producto, v_user, 'compra', v_cantidad, 1,
      v_costo, 'Compra', v_compra, v_variante
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

GRANT EXECUTE ON FUNCTION public.confirmar_compra(jsonb, text, date, text, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

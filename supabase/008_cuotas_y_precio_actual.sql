-- Cuotas en ventas + precio/costo actuales en productos.
-- Pegá TODO el archivo en el SQL Editor y dale Run. No pisa el resto de módulos.

ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS precio_venta NUMERIC(12,2);

ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS costo NUMERIC(12,2);

ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS cuotas INT DEFAULT 1;

ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS coeficiente_interes NUMERIC(5,2) DEFAULT 0;

ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS total_sin_interes NUMERIC(12,2);

ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS total_con_interes NUMERIC(12,2);

CREATE OR REPLACE FUNCTION public.crear_producto(
  p_nombre text,
  p_categoria text,
  p_precio_venta numeric,
  p_costo numeric,
  p_stock_inicial integer,
  p_activo boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
  v_user uuid := auth.uid();
  v_id uuid;
  v_stock integer;
  v_costo numeric;
BEGIN
  v_empresa := public.get_empresa_id();
  IF v_empresa IS NULL OR v_user IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;
  IF public.get_rol() NOT IN ('dueno', 'operador') THEN
    RAISE EXCEPTION 'NO_AUTORIZADO';
  END IF;
  IF p_nombre IS NULL OR length(trim(p_nombre)) = 0 THEN
    RAISE EXCEPTION 'NOMBRE_OBLIGATORIO';
  END IF;
  IF p_precio_venta IS NULL OR p_precio_venta < 0 THEN
    RAISE EXCEPTION 'PRECIO_INVALIDO';
  END IF;

  v_stock := COALESCE(p_stock_inicial, 0);
  IF v_stock < 0 THEN
    RAISE EXCEPTION 'STOCK_INVALIDO';
  END IF;
  v_costo := COALESCE(p_costo, 0);
  IF v_costo < 0 THEN
    RAISE EXCEPTION 'COSTO_INVALIDO';
  END IF;

  INSERT INTO public.productos (empresa_id, nombre, categoria, activo, precio_venta, costo)
  VALUES (
    v_empresa,
    trim(p_nombre),
    nullif(trim(coalesce(p_categoria, '')), ''),
    COALESCE(p_activo, TRUE),
    p_precio_venta,
    v_costo
  )
  RETURNING id INTO v_id;

  INSERT INTO public.precios_historial (empresa_id, producto_id, precio_venta, costo, fecha_desde)
  VALUES (v_empresa, v_id, p_precio_venta, v_costo, CURRENT_DATE);

  IF v_stock > 0 THEN
    INSERT INTO public.movimientos_inventario (
      empresa_id, producto_id, usuario_id, tipo, cantidad, signo, costo_unitario, motivo
    ) VALUES (
      v_empresa, v_id, v_user, 'ajuste_positivo', v_stock, 1, v_costo, 'Stock inicial'
    );
  END IF;

  RETURN v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.crear_producto(text, text, numeric, numeric, integer, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.actualizar_producto(
  p_id uuid,
  p_nombre text,
  p_categoria text,
  p_precio_venta numeric,
  p_costo numeric,
  p_activo boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
  v_costo numeric;
  v_precio_actual numeric;
  v_costo_actual numeric;
BEGIN
  v_empresa := public.get_empresa_id();
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;
  IF public.get_rol() NOT IN ('dueno', 'operador') THEN
    RAISE EXCEPTION 'NO_AUTORIZADO';
  END IF;
  IF p_nombre IS NULL OR length(trim(p_nombre)) = 0 THEN
    RAISE EXCEPTION 'NOMBRE_OBLIGATORIO';
  END IF;
  IF p_precio_venta IS NULL OR p_precio_venta < 0 THEN
    RAISE EXCEPTION 'PRECIO_INVALIDO';
  END IF;
  v_costo := COALESCE(p_costo, 0);
  IF v_costo < 0 THEN
    RAISE EXCEPTION 'COSTO_INVALIDO';
  END IF;

  SELECT h.precio_venta, h.costo INTO v_precio_actual, v_costo_actual
  FROM public.precios_historial h
  WHERE h.producto_id = p_id AND h.empresa_id = v_empresa
  ORDER BY h.fecha_desde DESC, h.id DESC
  LIMIT 1;

  UPDATE public.productos
  SET
    nombre = trim(p_nombre),
    categoria = nullif(trim(coalesce(p_categoria, '')), ''),
    activo = COALESCE(p_activo, TRUE),
    precio_venta = p_precio_venta,
    costo = v_costo
  WHERE id = p_id
    AND empresa_id = v_empresa
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCTO_INVALIDO';
  END IF;

  IF v_precio_actual IS DISTINCT FROM p_precio_venta
     OR v_costo_actual IS DISTINCT FROM v_costo THEN
    INSERT INTO public.precios_historial (empresa_id, producto_id, precio_venta, costo, fecha_desde)
    VALUES (v_empresa, p_id, p_precio_venta, v_costo, CURRENT_DATE);
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.actualizar_producto(uuid, text, text, numeric, numeric, boolean) TO authenticated;

DROP FUNCTION IF EXISTS public.confirmar_venta(jsonb, text, numeric, text);

CREATE OR REPLACE FUNCTION public.confirmar_venta(
  p_items jsonb,
  p_forma_pago text,
  p_descuento numeric,
  p_cliente text,
  p_cuotas integer DEFAULT 1,
  p_coeficiente_interes numeric DEFAULT 0,
  p_total_sin_interes numeric DEFAULT NULL,
  p_total_con_interes numeric DEFAULT NULL
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

  INSERT INTO public.ventas (
    empresa_id, usuario_id, forma_pago, descuento, cliente_nombre, canal,
    cuotas, coeficiente_interes, total_sin_interes, total_con_interes
  )
  VALUES (
    v_empresa,
    v_user,
    p_forma_pago,
    v_desc,
    nullif(trim(coalesce(p_cliente, '')), ''),
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

GRANT EXECUTE ON FUNCTION public.confirmar_venta(jsonb, text, numeric, text, integer, numeric, numeric, numeric) TO authenticated;

-- Importación masiva de ventas (fecha histórica + notas).
-- SQL Editor, rol postgres. Pegá TODO y dale Run.

CREATE OR REPLACE FUNCTION public.importar_venta(
  p_items jsonb,
  p_forma_pago text,
  p_descuento numeric,
  p_cliente text,
  p_cliente_id uuid,
  p_fecha timestamptz,
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
  v_venta uuid;
  v_item jsonb;
  v_producto uuid;
  v_cantidad integer;
  v_precio numeric;
  v_costo numeric;
  v_desc numeric;
  v_nombre text;
  v_fecha timestamptz;
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

  v_fecha := COALESCE(p_fecha, now());
  v_desc := COALESCE(p_descuento, 0);
  IF v_desc < 0 THEN
    RAISE EXCEPTION 'DESCUENTO_INVALIDO';
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
    empresa_id, usuario_id, fecha, forma_pago, descuento, cliente_nombre, cliente_id, canal,
    cuotas, coeficiente_interes, total_sin_interes, total_con_interes, notas
  )
  VALUES (
    v_empresa,
    v_user,
    v_fecha,
    p_forma_pago,
    v_desc,
    v_nombre,
    p_cliente_id,
    'mostrador',
    1,
    0,
    NULL,
    NULL,
    nullif(trim(coalesce(p_notas, '')), '')
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
      costo_unitario, precio_unitario, motivo, referencia_id, fecha
    ) VALUES (
      v_empresa, v_producto, v_user, 'venta', v_cantidad, -1,
      v_costo, v_precio, 'Venta importada', v_venta, v_fecha
    );
  END LOOP;

  RETURN v_venta;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.importar_venta(jsonb, text, numeric, text, uuid, timestamptz, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

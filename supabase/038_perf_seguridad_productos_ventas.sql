-- Performance: stock de productos + variantes en un JOIN.
-- Seguridad: validar que el producto de cada ítem de venta sea de la empresa.
-- SQL Editor, rol postgres. Pegá TODO y dale Run.

CREATE OR REPLACE FUNCTION public.listar_productos_con_stock()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa_id UUID := public.get_empresa_id();
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(p ORDER BY p.nombre)
      FROM (
        SELECT
          pr.id,
          pr.nombre,
          pr.categoria,
          pr.activo,
          pr.precio_venta,
          pr.costo,
          COALESCE(sb.stock, 0) AS stock_base,
          COALESCE(sv.variantes_stock, '[]'::jsonb) AS variantes_stock
        FROM public.productos pr
        LEFT JOIN (
          SELECT
            m.producto_id,
            COALESCE(SUM(m.cantidad * m.signo), 0) AS stock
          FROM public.movimientos_inventario m
          WHERE m.empresa_id = v_empresa_id
            AND m.deleted_at IS NULL
            AND m.variante_id IS NULL
            AND COALESCE(m.tipo, '') <> 'transferencia'
          GROUP BY m.producto_id
        ) sb ON sb.producto_id = pr.id
        LEFT JOIN (
          SELECT
            pv.producto_id,
            jsonb_agg(
              jsonb_build_object(
                'variante_id', pv.id,
                'atributos', pv.atributos,
                'precio', pv.precio_venta,
                'costo', pv.costo,
                'activo', pv.activo,
                'stock', COALESCE(ms.stock, 0)
              )
              ORDER BY pv.id
            ) AS variantes_stock
          FROM public.producto_variantes pv
          LEFT JOIN (
            SELECT
              m.variante_id,
              COALESCE(SUM(m.cantidad * m.signo), 0) AS stock
            FROM public.movimientos_inventario m
            WHERE m.empresa_id = v_empresa_id
              AND m.deleted_at IS NULL
              AND m.variante_id IS NOT NULL
              AND COALESCE(m.tipo, '') <> 'transferencia'
            GROUP BY m.variante_id
          ) ms ON ms.variante_id = pv.id
          WHERE pv.empresa_id = v_empresa_id
            AND pv.deleted_at IS NULL
          GROUP BY pv.producto_id
        ) sv ON sv.producto_id = pr.id
        WHERE pr.empresa_id = v_empresa_id
          AND pr.deleted_at IS NULL
      ) p
    ),
    '[]'::jsonb
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.listar_productos_con_stock() TO authenticated;

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
      SELECT 1 FROM public.productos
      WHERE id = v_producto
        AND empresa_id = public.get_empresa_id()
        AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Producto no pertenece a esta empresa';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.productos p
      WHERE p.id = v_producto
        AND p.empresa_id = v_empresa
        AND p.activo = TRUE
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

NOTIFY pgrst, 'reload schema';

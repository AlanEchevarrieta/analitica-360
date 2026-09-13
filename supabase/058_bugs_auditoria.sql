-- Correcciones de auditoría: stock/costo de productos, historial de clientes,
-- margen de analytics y listado de ubicaciones.
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
          CASE WHEN to_regclass('public.categorias') IS NOT NULL THEN pr.categoria_id ELSE NULL END AS categoria_id,
          pr.activo,
          pr.precio_venta,
          pr.costo,
          pr.codigo_barra,
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

DROP FUNCTION IF EXISTS public.listar_productos_empresa();

CREATE OR REPLACE FUNCTION public.listar_productos_empresa()
RETURNS TABLE (
  id uuid,
  nombre text,
  categoria text,
  activo boolean,
  precio_venta numeric,
  costo numeric,
  stock_actual bigint,
  codigo_barra text
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
    p.id,
    p.nombre,
    p.categoria,
    p.activo,
    COALESCE(p.precio_venta, 0),
    COALESCE(p.costo, 0),
    COALESCE((
      SELECT SUM(m.cantidad * m.signo)::bigint
      FROM public.movimientos_inventario m
      WHERE m.producto_id = p.id
        AND m.empresa_id = v_empresa
        AND m.deleted_at IS NULL
        AND m.variante_id IS NULL
        AND COALESCE(m.tipo, '') <> 'transferencia'
    ), 0),
    p.codigo_barra
  FROM public.productos p
  WHERE p.empresa_id = v_empresa
    AND p.deleted_at IS NULL
  ORDER BY p.nombre;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.listar_productos_empresa() TO authenticated;

CREATE OR REPLACE FUNCTION public.ventas_match_cliente(p_empresa uuid, p_cliente uuid, p_nombre text)
RETURNS TABLE (id uuid, fecha timestamptz, productos text, total numeric, forma_pago text)
LANGUAGE sql
STABLE
SET search_path TO public
AS $function$
  SELECT DISTINCT ON (v.id)
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
      v.total_con_interes,
      (
        SELECT SUM(i.precio_unitario * i.cantidad)
        FROM public.ventas_items i
        WHERE i.venta_id = v.id
      ) - COALESCE(v.descuento, 0)
    ),
    v.forma_pago
  FROM public.ventas v
  WHERE v.empresa_id = p_empresa
    AND v.deleted_at IS NULL
    AND (
      v.cliente_id = p_cliente
      OR (
        v.cliente_id IS NULL
        AND p_nombre IS NOT NULL
        AND lower(trim(coalesce(v.cliente_nombre, ''))) = lower(trim(p_nombre))
      )
    )
  ORDER BY v.id, v.fecha DESC;
$function$;

GRANT EXECUTE ON FUNCTION public.ventas_match_cliente(uuid, uuid, text) TO authenticated;

DROP FUNCTION IF EXISTS public.analytics_periodo(date, date, uuid);
DROP FUNCTION IF EXISTS public.analytics_periodo(date, date);

CREATE OR REPLACE FUNCTION public.analytics_periodo(
  p_desde date,
  p_hasta date,
  p_empresa_id uuid DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
SET statement_timeout = '15s'
AS $$
  WITH emp AS (
    SELECT COALESCE(p_empresa_id, public.get_empresa_id()) AS id
  ),
  periodo AS (
    SELECT v.id, v.fecha, v.total_con_interes, v.forma_pago
    FROM public.ventas v
    JOIN emp ON v.empresa_id = emp.id
    WHERE v.fecha::date BETWEEN p_desde AND p_hasta
      AND v.deleted_at IS NULL
  ),
  costos AS (
    SELECT COALESCE(SUM(
      COALESCE(vi.costo_unitario, pr.costo, 0) * vi.cantidad
    ), 0) AS costo
    FROM public.ventas_items vi
    JOIN periodo p ON p.id = vi.venta_id
    LEFT JOIN public.productos pr ON pr.id = vi.producto_id
  )
  SELECT jsonb_build_object(
    'total_ventas', COALESCE((SELECT SUM(total_con_interes) FROM periodo), 0),
    'cantidad', (SELECT COUNT(*) FROM periodo),
    'ticket_promedio', COALESCE((SELECT AVG(total_con_interes) FROM periodo), 0),
    'costo', (SELECT costo FROM costos),
    'ventas', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'fecha', fecha,
          'total', total_con_interes,
          'forma_pago', forma_pago
        )
        ORDER BY fecha
      )
      FROM periodo
    ), '[]'::jsonb)
  );
$$;

GRANT EXECUTE ON FUNCTION public.analytics_periodo(date, date, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.listar_ubicaciones_empresa()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid := public.get_empresa_id();
BEGIN
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(row_to_json(u) ORDER BY u.nombre)
      FROM (
        SELECT
          id,
          nombre,
          descripcion,
          COALESCE(tipo, 'otro') AS tipo,
          COALESCE(activo, TRUE) AS activo
        FROM public.ubicaciones
        WHERE empresa_id = v_empresa
      ) u
    ),
    '[]'::jsonb
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.listar_ubicaciones_empresa() TO authenticated;

NOTIFY pgrst, 'reload schema';

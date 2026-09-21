-- Restaura productos y top_10 en analytics_periodo (068 los omitió).
-- SQL Editor, rol postgres. Pegá TODO y dale Run.

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
    SELECT
      v.id,
      v.fecha,
      v.forma_pago,
      GREATEST(COALESCE(v.total_con_interes, 0) - COALESCE(v.saldo_pendiente, 0), 0) AS cobrado,
      COALESCE(v.saldo_pendiente, 0) AS saldo
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
  ),
  por_producto AS (
    SELECT
      COALESCE(pr.nombre, 'Producto') AS nombre,
      SUM(vi.cantidad)::int AS unidades,
      SUM(vi.cantidad * vi.precio_unitario) AS total,
      SUM(vi.cantidad * COALESCE(vi.costo_unitario, pr.costo, 0)) AS costo
    FROM public.ventas_items vi
    JOIN periodo p ON p.id = vi.venta_id
    LEFT JOIN public.productos pr ON pr.id = vi.producto_id
    GROUP BY COALESCE(pr.nombre, 'Producto')
  )
  SELECT jsonb_build_object(
    'total_ventas', COALESCE((SELECT SUM(cobrado) FROM periodo), 0),
    'cantidad', (SELECT COUNT(*) FROM periodo),
    'ticket_promedio', COALESCE((SELECT AVG(cobrado) FROM periodo), 0),
    'costo', (SELECT costo FROM costos),
    'por_cobrar', COALESCE((SELECT SUM(saldo) FROM periodo), 0),
    'ventas', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'fecha', fecha,
          'total', cobrado,
          'forma_pago', forma_pago
        )
        ORDER BY fecha
      )
      FROM periodo
    ), '[]'::jsonb),
    'productos', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'producto', nombre,
          'unidades', unidades,
          'total', total,
          'costo', costo,
          'margen', total - costo,
          'margen_pct', CASE WHEN total > 0 THEN round(((total - costo) / total) * 100, 1) ELSE 0 END
        )
        ORDER BY total DESC, nombre
      )
      FROM por_producto
    ), '[]'::jsonb),
    'top_10', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'nombre', nombre,
          'unidades', unidades,
          'total', total
        )
        ORDER BY unidades DESC, nombre
      )
      FROM (
        SELECT nombre, unidades, total
        FROM por_producto
        ORDER BY unidades DESC, nombre
        LIMIT 10
      ) t
    ), '[]'::jsonb)
  );
$$;

GRANT EXECUTE ON FUNCTION public.analytics_periodo(date, date, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

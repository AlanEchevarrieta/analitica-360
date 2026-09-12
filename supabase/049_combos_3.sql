-- Combos de 3 productos (solo lectura).
-- SQL Editor, rol postgres. Pegá TODO y dale Run.

CREATE OR REPLACE FUNCTION public.insights_combos_3(
  p_empresa_id uuid DEFAULT NULL,
  p_limit int DEFAULT 10
)
RETURNS TABLE(
  nombre_a text,
  nombre_b text,
  nombre_c text,
  veces_juntos bigint,
  soporte numeric,
  lift numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
AS $$
  WITH empresa AS (
    SELECT COALESCE(public.get_empresa_id(), p_empresa_id) as id
  ),
  ventas_empresa AS (
    SELECT v.id
    FROM ventas v
    JOIN empresa e ON e.id = v.empresa_id
    WHERE v.deleted_at IS NULL
    AND (
      SELECT COUNT(*) FROM ventas_items vi
      WHERE vi.venta_id = v.id
    ) >= 3
  ),
  total AS (
    SELECT COUNT(*) as total FROM ventas_empresa
  ),
  trios AS (
    SELECT
      a.producto_id as prod_a,
      b.producto_id as prod_b,
      c.producto_id as prod_c,
      COUNT(*) as juntos
    FROM ventas_items a
    JOIN ventas_items b ON a.venta_id = b.venta_id
      AND a.producto_id < b.producto_id
    JOIN ventas_items c ON a.venta_id = c.venta_id
      AND b.producto_id < c.producto_id
    JOIN ventas_empresa ve ON ve.id = a.venta_id
    GROUP BY a.producto_id, b.producto_id, c.producto_id
    HAVING COUNT(*) >= 2
  ),
  frecuencia AS (
    SELECT
      vi.producto_id,
      COUNT(DISTINCT vi.venta_id) as frecuencia
    FROM ventas_items vi
    JOIN ventas_empresa ve ON ve.id = vi.venta_id
    GROUP BY vi.producto_id
  )
  SELECT
    pa.nombre,
    pb.nombre,
    pc.nombre,
    t.juntos,
    ROUND((t.juntos::numeric / NULLIF(tot.total, 0)) * 100, 1),
    ROUND(
      (t.juntos::numeric / NULLIF(tot.total, 0)) /
      NULLIF(
        (fa.frecuencia::numeric / NULLIF(tot.total, 0)) *
        (fb.frecuencia::numeric / NULLIF(tot.total, 0)) *
        (fc.frecuencia::numeric / NULLIF(tot.total, 0)),
        0
      ),
      2
    )
  FROM trios t
  JOIN productos pa ON pa.id = t.prod_a
  JOIN productos pb ON pb.id = t.prod_b
  JOIN productos pc ON pc.id = t.prod_c
  JOIN frecuencia fa ON fa.producto_id = t.prod_a
  JOIN frecuencia fb ON fb.producto_id = t.prod_b
  JOIN frecuencia fc ON fc.producto_id = t.prod_c
  CROSS JOIN total tot
  ORDER BY t.juntos DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.insights_combos_3(uuid, int) TO authenticated;

NOTIFY pgrst, 'reload schema';

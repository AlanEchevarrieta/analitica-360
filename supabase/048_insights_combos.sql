-- Combos: productos que se venden juntos (solo lectura).
-- SQL Editor, rol postgres. Pegá TODO y dale Run.

CREATE OR REPLACE FUNCTION public.insights_combos(
  p_empresa_id uuid DEFAULT NULL,
  p_limit int DEFAULT 10
)
RETURNS TABLE(
  producto_a_id uuid,
  producto_b_id uuid,
  nombre_a text,
  nombre_b text,
  veces_juntos bigint,
  total_ventas bigint,
  soporte numeric,
  confianza_a numeric,
  confianza_b numeric,
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
    SELECT v.id, COUNT(vi.id) as items
    FROM ventas v
    JOIN ventas_items vi ON vi.venta_id = v.id
    JOIN empresa e ON e.id = v.empresa_id
    WHERE v.deleted_at IS NULL
    GROUP BY v.id
    HAVING COUNT(vi.id) > 1
  ),
  total AS (
    SELECT COUNT(*) as total FROM ventas_empresa
  ),
  pares AS (
    SELECT
      a.producto_id as prod_a,
      b.producto_id as prod_b,
      COUNT(*) as juntos
    FROM ventas_items a
    JOIN ventas_items b ON a.venta_id = b.venta_id
      AND a.producto_id < b.producto_id
    JOIN ventas_empresa ve ON ve.id = a.venta_id
    GROUP BY a.producto_id, b.producto_id
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
    p.prod_a,
    p.prod_b,
    pa.nombre,
    pb.nombre,
    p.juntos,
    t.total,
    ROUND((p.juntos::numeric / NULLIF(t.total, 0)) * 100, 1) as soporte,
    ROUND((p.juntos::numeric / NULLIF(fa.frecuencia, 0)) * 100, 1) as confianza_a,
    ROUND((p.juntos::numeric / NULLIF(fb.frecuencia, 0)) * 100, 1) as confianza_b,
    ROUND(
      (p.juntos::numeric / NULLIF(t.total, 0)) /
      NULLIF(
        (fa.frecuencia::numeric / NULLIF(t.total, 0)) *
        (fb.frecuencia::numeric / NULLIF(t.total, 0)),
        0
      ),
      2
    ) as lift
  FROM pares p
  JOIN productos pa ON pa.id = p.prod_a
  JOIN productos pb ON pb.id = p.prod_b
  JOIN frecuencia fa ON fa.producto_id = p.prod_a
  JOIN frecuencia fb ON fb.producto_id = p.prod_b
  CROSS JOIN total t
  WHERE p.juntos >= 3
  ORDER BY p.juntos DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.insights_combos(uuid, int) TO authenticated;

NOTIFY pgrst, 'reload schema';

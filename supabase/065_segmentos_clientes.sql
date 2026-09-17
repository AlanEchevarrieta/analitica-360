-- Segmentos inteligentes de clientes (CRM).
-- SQL Editor, rol postgres. Pegá TODO y dale Run.
-- Usa clientes.cumpleanos (no existe fecha_nacimiento).

CREATE OR REPLACE FUNCTION public.segmentos_clientes()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
AS $$
  WITH ultima_compra AS (
    SELECT
      c.id,
      c.nombre,
      c.telefono,
      c.cumpleanos AS fecha_nacimiento,
      MAX(v.fecha) AS ultima_venta,
      COUNT(v.id) FILTER (WHERE v.id IS NOT NULL) AS total_compras,
      COALESCE(SUM(v.total_con_interes), 0) AS total_facturado,
      (CURRENT_DATE - (MAX(v.fecha)::date)) AS dias_sin_comprar
    FROM public.clientes c
    LEFT JOIN public.ventas v
      ON v.empresa_id = c.empresa_id
     AND v.deleted_at IS NULL
     AND (
       v.cliente_id = c.id
       OR (NULLIF(btrim(COALESCE(v.cliente_nombre, '')), '') IS NOT NULL AND v.cliente_nombre = c.nombre)
     )
    WHERE c.empresa_id = public.get_empresa_id()
      AND c.deleted_at IS NULL
    GROUP BY c.id, c.nombre, c.telefono, c.cumpleanos
  ),
  cumple_rango AS (
    SELECT u.*
    FROM ultima_compra u
    WHERE u.fecha_nacimiento IS NOT NULL
      AND (
        (
          to_char(CURRENT_DATE + INTERVAL '7 days', 'MMDD') >= to_char(CURRENT_DATE, 'MMDD')
          AND to_char(u.fecha_nacimiento, 'MMDD') BETWEEN to_char(CURRENT_DATE, 'MMDD') AND to_char(CURRENT_DATE + INTERVAL '7 days', 'MMDD')
        )
        OR (
          to_char(CURRENT_DATE + INTERVAL '7 days', 'MMDD') < to_char(CURRENT_DATE, 'MMDD')
          AND (
            to_char(u.fecha_nacimiento, 'MMDD') >= to_char(CURRENT_DATE, 'MMDD')
            OR to_char(u.fecha_nacimiento, 'MMDD') <= to_char(CURRENT_DATE + INTERVAL '7 days', 'MMDD')
          )
        )
      )
  )
  SELECT jsonb_build_object(
    'inactivos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'nombre', nombre,
        'telefono', telefono,
        'dias', dias_sin_comprar,
        'ultima_compra', ultima_venta
      ) ORDER BY COALESCE(dias_sin_comprar, 9999) DESC)
      FROM ultima_compra
      WHERE dias_sin_comprar > 60 OR ultima_venta IS NULL
    ), '[]'::jsonb),
    'en_riesgo', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'nombre', nombre,
        'telefono', telefono,
        'dias', dias_sin_comprar,
        'ultima_compra', ultima_venta
      ) ORDER BY dias_sin_comprar DESC)
      FROM ultima_compra
      WHERE dias_sin_comprar BETWEEN 30 AND 60
    ), '[]'::jsonb),
    'cumpleanos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'nombre', nombre,
        'telefono', telefono,
        'fecha_nacimiento', fecha_nacimiento
      ) ORDER BY to_char(fecha_nacimiento, 'MMDD'))
      FROM cumple_rango
    ), '[]'::jsonb),
    'vip', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', t.id,
        'nombre', t.nombre,
        'telefono', t.telefono,
        'total_facturado', t.total_facturado,
        'total_compras', t.total_compras
      ) ORDER BY t.total_facturado DESC)
      FROM (
        SELECT id, nombre, telefono, total_facturado, total_compras
        FROM ultima_compra
        WHERE total_facturado > 0
        ORDER BY total_facturado DESC
        LIMIT 5
      ) t
    ), '[]'::jsonb),
    'conteos', jsonb_build_object(
      'inactivos', (SELECT COUNT(*) FROM ultima_compra WHERE dias_sin_comprar > 60 OR ultima_venta IS NULL),
      'en_riesgo', (SELECT COUNT(*) FROM ultima_compra WHERE dias_sin_comprar BETWEEN 30 AND 60),
      'cumpleanos', (SELECT COUNT(*) FROM cumple_rango),
      'vip', (SELECT COUNT(*) FROM ultima_compra WHERE total_facturado > 0)
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.segmentos_clientes() TO authenticated;

NOTIFY pgrst, 'reload schema';

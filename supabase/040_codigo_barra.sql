-- Código de barras en productos.
-- SQL Editor, rol postgres. Pegá TODO y dale Run.

ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS codigo_barra TEXT;

CREATE INDEX IF NOT EXISTS idx_productos_codigo_barra
  ON public.productos (codigo_barra, empresa_id);

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
    COALESCE(ph.precio_venta, 0),
    COALESCE(ph.costo, 0),
    COALESCE((
      SELECT SUM(m.cantidad * m.signo)::bigint
      FROM public.movimientos_inventario m
      WHERE m.producto_id = p.id
        AND m.empresa_id = v_empresa
        AND m.deleted_at IS NULL
    ), 0),
    p.codigo_barra
  FROM public.productos p
  LEFT JOIN LATERAL (
    SELECT h.precio_venta, h.costo
    FROM public.precios_historial h
    WHERE h.producto_id = p.id
      AND h.empresa_id = v_empresa
    ORDER BY h.fecha_desde DESC, h.id DESC
    LIMIT 1
  ) ph ON TRUE
  WHERE p.empresa_id = v_empresa
    AND p.deleted_at IS NULL
  ORDER BY p.nombre;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.listar_productos_empresa() TO authenticated;

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

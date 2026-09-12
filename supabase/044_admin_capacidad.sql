-- Capacidad del sistema (panel /admin).
-- SQL Editor, rol postgres. Pegá TODO y dale Run.

CREATE OR REPLACE FUNCTION public.admin_capacidad()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_ventas bigint;
  v_productos bigint;
  v_clientes bigint;
  v_movimientos bigint;
  v_empresas bigint;
  v_registros_mes bigint;
BEGIN
  IF NOT public.es_admin_app() THEN
    RAISE EXCEPTION 'NO_AUTORIZADO';
  END IF;

  SELECT COUNT(*) INTO v_ventas FROM public.ventas;
  SELECT COUNT(*) INTO v_productos FROM public.productos;
  SELECT COUNT(*) INTO v_clientes FROM public.clientes;
  SELECT COUNT(*) INTO v_movimientos FROM public.movimientos_inventario;
  SELECT COUNT(*) INTO v_empresas FROM public.empresas WHERE deleted_at IS NULL;

  SELECT
    (SELECT COUNT(*) FROM public.ventas WHERE fecha >= DATE_TRUNC('month', CURRENT_DATE))
    + (SELECT COUNT(*) FROM public.productos WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE))
    + (SELECT COUNT(*) FROM public.clientes WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE))
    + (SELECT COUNT(*) FROM public.movimientos_inventario WHERE fecha >= DATE_TRUNC('month', CURRENT_DATE))
  INTO v_registros_mes;

  RETURN jsonb_build_object(
    'ventas', v_ventas,
    'productos', v_productos,
    'clientes', v_clientes,
    'movimientos', v_movimientos,
    'empresas', v_empresas,
    'total_registros', v_ventas + v_productos + v_clientes + v_movimientos,
    'registros_ultimo_mes', v_registros_mes,
    'tablas', COALESCE((
      SELECT jsonb_agg(t)
      FROM (
        SELECT
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(format('%I.%I', schemaname, tablename)::regclass)) AS tamano,
          pg_total_relation_size(format('%I.%I', schemaname, tablename)::regclass) AS bytes
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(format('%I.%I', schemaname, tablename)::regclass) DESC
      ) t
    ), '[]'::jsonb)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_capacidad() TO authenticated;

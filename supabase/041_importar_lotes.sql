-- Importación masiva en lotes (ventas, compras, productos).
-- SQL Editor, rol postgres. Pegá TODO y dale Run.

CREATE OR REPLACE FUNCTION public.importar_ventas_lote(p_ventas jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_row jsonb;
  v_ok integer := 0;
  v_errores jsonb := '[]'::jsonb;
BEGIN
  IF public.get_empresa_id() IS NULL OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;
  IF p_ventas IS NULL OR jsonb_typeof(p_ventas) <> 'array' THEN
    RAISE EXCEPTION 'LOTE_INVALIDO';
  END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_ventas)
  LOOP
    BEGIN
      PERFORM public.importar_venta(
        v_row->'items',
        v_row->>'forma_pago',
        COALESCE((v_row->>'descuento')::numeric, 0),
        v_row->>'cliente',
        NULLIF(v_row->>'cliente_id', '')::uuid,
        (v_row->>'fecha')::timestamptz,
        v_row->>'notas'
      );
      v_ok := v_ok + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errores := v_errores || jsonb_build_array(
        jsonb_build_object(
          'fila', COALESCE((v_row->>'fila')::integer, 0),
          'motivo', SQLERRM
        )
      );
    END;
  END LOOP;

  RETURN jsonb_build_object('importados', v_ok, 'errores', v_errores);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.importar_ventas_lote(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.importar_compras_lote(p_compras jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_row jsonb;
  v_ok integer := 0;
  v_errores jsonb := '[]'::jsonb;
BEGIN
  IF public.get_empresa_id() IS NULL OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;
  IF p_compras IS NULL OR jsonb_typeof(p_compras) <> 'array' THEN
    RAISE EXCEPTION 'LOTE_INVALIDO';
  END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_compras)
  LOOP
    BEGIN
      PERFORM public.confirmar_compra(
        v_row->'items',
        v_row->>'proveedor',
        (v_row->>'fecha')::date,
        v_row->>'notas',
        NULLIF(v_row->>'proveedor_id', '')::uuid
      );
      v_ok := v_ok + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errores := v_errores || jsonb_build_array(
        jsonb_build_object(
          'fila', COALESCE((v_row->>'fila')::integer, 0),
          'motivo', SQLERRM
        )
      );
    END;
  END LOOP;

  RETURN jsonb_build_object('importados', v_ok, 'errores', v_errores);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.importar_compras_lote(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.crear_productos_lote(p_productos jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
  v_row jsonb;
  v_ok integer := 0;
  v_saltados jsonb := '[]'::jsonb;
  v_nombre text;
  v_id uuid;
BEGIN
  v_empresa := public.get_empresa_id();
  IF v_empresa IS NULL OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;
  IF p_productos IS NULL OR jsonb_typeof(p_productos) <> 'array' THEN
    RAISE EXCEPTION 'LOTE_INVALIDO';
  END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_productos)
  LOOP
    v_nombre := trim(coalesce(v_row->>'nombre', ''));
    IF v_nombre = '' THEN
      v_saltados := v_saltados || jsonb_build_array('Producto sin nombre');
      CONTINUE;
    END IF;
    IF EXISTS (
      SELECT 1
      FROM public.productos p
      WHERE p.empresa_id = v_empresa
        AND p.deleted_at IS NULL
        AND lower(p.nombre) = lower(v_nombre)
    ) THEN
      v_saltados := v_saltados || jsonb_build_array(v_nombre);
      CONTINUE;
    END IF;
    BEGIN
      v_id := public.crear_producto(
        v_nombre,
        coalesce(v_row->>'categoria', ''),
        COALESCE((v_row->>'precio_venta')::numeric, 0),
        COALESCE((v_row->>'costo')::numeric, 0),
        COALESCE((v_row->>'stock_inicial')::integer, 0),
        COALESCE((v_row->>'activo')::boolean, TRUE)
      );
      IF v_id IS NOT NULL THEN
        v_ok := v_ok + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_saltados := v_saltados || jsonb_build_array(v_nombre || ' (' || SQLERRM || ')');
    END;
  END LOOP;

  RETURN jsonb_build_object('importados', v_ok, 'saltados', v_saltados);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.crear_productos_lote(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';

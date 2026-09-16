-- Al anular una venta, devolver stock con un movimiento positivo por ítem
-- (incluye variante_id; el SQL anterior lo omitía y el stock no se restauraba).
-- SQL Editor, rol postgres. Pegá TODO y dale Run.

CREATE OR REPLACE FUNCTION public.anular_venta(p_id uuid, p_motivo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
  v_user uuid := auth.uid();
  v_motivo text;
BEGIN
  v_empresa := public.get_empresa_id();
  IF v_empresa IS NULL OR v_user IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;
  IF public.get_rol() <> 'dueno' THEN
    RAISE EXCEPTION 'NO_AUTORIZADO';
  END IF;
  IF p_motivo IS NULL OR length(trim(p_motivo)) = 0 THEN
    RAISE EXCEPTION 'MOTIVO_OBLIGATORIO';
  END IF;

  v_motivo := trim(p_motivo);

  UPDATE public.ventas
  SET deleted_at = now()
  WHERE id = p_id
    AND empresa_id = v_empresa
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VENTA_INVALIDA';
  END IF;

  INSERT INTO public.movimientos_inventario (
    empresa_id, producto_id, usuario_id,
    variante_id, tipo, signo, cantidad, motivo,
    lote_id, costo_unitario, precio_unitario, referencia_id
  )
  SELECT
    v.empresa_id,
    vi.producto_id,
    v_user,
    vi.variante_id,
    'anulacion',
    1,
    vi.cantidad,
    COALESCE(
      NULLIF(v_motivo, ''),
      'Anulación de venta ' || COALESCE(v.numero_venta, v.id::text)
    ),
    vi.lote_id,
    vi.costo_unitario,
    vi.precio_unitario,
    v.id
  FROM public.ventas_items vi
  JOIN public.ventas v ON v.id = vi.venta_id
  WHERE v.id = p_id
    AND v.empresa_id = v_empresa
    AND vi.producto_id IS NOT NULL
    AND vi.cantidad > 0;

  INSERT INTO public.anulaciones (empresa_id, venta_id, usuario_id, motivo)
  VALUES (v_empresa, p_id, v_user, v_motivo);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.anular_venta(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Costos reales en compras (flete, impuestos, otros).
-- SQL Editor, rol postgres. Pegá TODO y dale Run.

ALTER TABLE public.compras
  ADD COLUMN IF NOT EXISTS costo_flete NUMERIC(12,2) DEFAULT 0;

ALTER TABLE public.compras
  ADD COLUMN IF NOT EXISTS costo_impuestos NUMERIC(12,2) DEFAULT 0;

ALTER TABLE public.compras
  ADD COLUMN IF NOT EXISTS costo_otros NUMERIC(12,2) DEFAULT 0;

ALTER TABLE public.compras
  ADD COLUMN IF NOT EXISTS descripcion_otros TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'compras'
      AND column_name = 'total_costos_adicionales'
  ) THEN
    ALTER TABLE public.compras
      ADD COLUMN total_costos_adicionales NUMERIC(12,2)
      GENERATED ALWAYS AS (
        COALESCE(costo_flete, 0) + COALESCE(costo_impuestos, 0) + COALESCE(costo_otros, 0)
      ) STORED;
  END IF;
END $$;

ALTER TABLE public.compras
  ADD COLUMN IF NOT EXISTS total_real NUMERIC(12,2) DEFAULT 0;

CREATE OR REPLACE FUNCTION public.aplicar_costos_compra(
  p_id uuid,
  p_flete numeric DEFAULT 0,
  p_impuestos numeric DEFAULT 0,
  p_otros numeric DEFAULT 0,
  p_descripcion text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_emp uuid := public.get_empresa_id();
  v_flete numeric := GREATEST(COALESCE(p_flete, 0), 0);
  v_imp numeric := GREATEST(COALESCE(p_impuestos, 0), 0);
  v_otros numeric := GREATEST(COALESCE(p_otros, 0), 0);
  v_extra numeric;
  v_subtotal numeric;
  r record;
  v_share numeric;
  v_nuevo numeric;
BEGIN
  IF v_emp IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;
  IF public.get_rol() NOT IN ('dueno', 'operador') THEN
    RAISE EXCEPTION 'NO_AUTORIZADO';
  END IF;

  v_extra := ROUND(v_flete + v_imp + v_otros, 2);

  UPDATE public.compras
  SET
    costo_flete = v_flete,
    costo_impuestos = v_imp,
    costo_otros = v_otros,
    descripcion_otros = NULLIF(trim(COALESCE(p_descripcion, '')), ''),
    total_real = COALESCE(total, 0) + v_extra
  WHERE id = p_id AND empresa_id = v_emp AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COMPRA_INVALIDA';
  END IF;

  SELECT COALESCE(total, 0) INTO v_subtotal
  FROM public.compras
  WHERE id = p_id AND empresa_id = v_emp;

  IF v_extra <= 0 OR v_subtotal <= 0 THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT id, producto_id, variante_id, cantidad, costo_unitario, subtotal
    FROM public.compras_items
    WHERE compra_id = p_id AND empresa_id = v_emp
  LOOP
    v_share := ROUND((COALESCE(r.subtotal, r.cantidad * r.costo_unitario) / v_subtotal) * v_extra, 2);
    IF r.cantidad IS NULL OR r.cantidad <= 0 THEN
      CONTINUE;
    END IF;
    v_nuevo := ROUND((COALESCE(r.subtotal, r.cantidad * r.costo_unitario) + v_share) / r.cantidad, 2);

    UPDATE public.compras_items
    SET costo_unitario = v_nuevo, subtotal = ROUND(r.cantidad * v_nuevo, 2)
    WHERE id = r.id;

    UPDATE public.productos
    SET costo = v_nuevo
    WHERE id = r.producto_id AND empresa_id = v_emp AND deleted_at IS NULL;

    IF r.variante_id IS NOT NULL THEN
      UPDATE public.producto_variantes
      SET costo = v_nuevo
      WHERE id = r.variante_id AND empresa_id = v_emp AND deleted_at IS NULL;
    END IF;

    UPDATE public.movimientos_inventario
    SET costo_unitario = v_nuevo
    WHERE referencia_id = p_id
      AND producto_id = r.producto_id
      AND empresa_id = v_emp
      AND tipo = 'compra'
      AND (r.variante_id IS NULL OR variante_id IS NOT DISTINCT FROM r.variante_id);
  END LOOP;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.aplicar_costos_compra(uuid, numeric, numeric, numeric, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

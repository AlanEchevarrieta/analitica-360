-- Anulación de ventas: stock, motivo y visibilidad de anuladas.
-- SQL Editor, rol postgres. Pegá TODO y dale Run.

CREATE TABLE IF NOT EXISTS public.anulaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  venta_id UUID NOT NULL REFERENCES public.ventas(id),
  usuario_id UUID REFERENCES public.usuarios(id),
  motivo TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.anulaciones ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.anulaciones TO authenticated;

DROP POLICY IF EXISTS anulaciones_select ON public.anulaciones;
CREATE POLICY anulaciones_select ON public.anulaciones
  FOR SELECT USING (empresa_id = public.get_empresa_id());

DROP POLICY IF EXISTS anulaciones_insert ON public.anulaciones;
CREATE POLICY anulaciones_insert ON public.anulaciones
  FOR INSERT WITH CHECK (
    empresa_id = public.get_empresa_id()
    AND public.get_rol() = 'dueno'
  );

DROP POLICY IF EXISTS ventas_select ON public.ventas;
CREATE POLICY ventas_select ON public.ventas
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_empresa_id());

DROP FUNCTION IF EXISTS public.anular_venta(uuid);
DROP FUNCTION IF EXISTS public.anular_venta(uuid, text);

CREATE OR REPLACE FUNCTION public.anular_venta(p_id uuid, p_motivo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
  v_user uuid := auth.uid();
  v_item record;
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

  UPDATE public.ventas
  SET deleted_at = now()
  WHERE id = p_id
    AND empresa_id = v_empresa
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VENTA_INVALIDA';
  END IF;

  FOR v_item IN
    SELECT i.producto_id, i.cantidad, i.costo_unitario, i.precio_unitario
    FROM public.ventas_items i
    WHERE i.venta_id = p_id AND i.empresa_id = v_empresa
  LOOP
    INSERT INTO public.movimientos_inventario (
      empresa_id, producto_id, usuario_id, tipo, cantidad, signo,
      costo_unitario, precio_unitario, motivo, referencia_id
    ) VALUES (
      v_empresa, v_item.producto_id, v_user, 'devolucion_cliente', v_item.cantidad, 1,
      v_item.costo_unitario, v_item.precio_unitario, trim(p_motivo), p_id
    );
  END LOOP;

  INSERT INTO public.anulaciones (empresa_id, venta_id, usuario_id, motivo)
  VALUES (v_empresa, p_id, v_user, trim(p_motivo));
END;
$function$;

GRANT EXECUTE ON FUNCTION public.anular_venta(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

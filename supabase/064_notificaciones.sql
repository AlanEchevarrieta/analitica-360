-- Conteos para el centro de notificaciones del navbar.
-- SQL Editor, rol postgres. Pegá TODO y dale Run.

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.contar_notificaciones()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_emp uuid := public.get_empresa_id();
  v_tickets bigint := 0;
  v_pedidos bigint := 0;
  v_vencidos bigint := 0;
  v_por_vencer bigint := 0;
BEGIN
  IF v_emp IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;

  BEGIN
    SELECT COUNT(*) INTO v_tickets
    FROM public.tickets
    WHERE empresa_id = v_emp
      AND estado IN ('abierto', 'en_proceso')
      AND deleted_at IS NULL;
  EXCEPTION
    WHEN undefined_table OR undefined_column THEN
      v_tickets := 0;
  END;

  BEGIN
    SELECT COUNT(*) INTO v_pedidos
    FROM public.pedidos
    WHERE empresa_id = v_emp
      AND estado = 'nuevo'
      AND deleted_at IS NULL;
  EXCEPTION
    WHEN undefined_table OR undefined_column THEN
      v_pedidos := 0;
  END;

  BEGIN
    SELECT COUNT(*) INTO v_vencidos
    FROM public.lotes
    WHERE empresa_id = v_emp
      AND fecha_vencimiento < CURRENT_DATE
      AND activo = TRUE;
  EXCEPTION
    WHEN undefined_table OR undefined_column THEN
      v_vencidos := 0;
  END;

  BEGIN
    SELECT COUNT(*) INTO v_por_vencer
    FROM public.lotes
    WHERE empresa_id = v_emp
      AND fecha_vencimiento BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '30 days')
      AND activo = TRUE;
  EXCEPTION
    WHEN undefined_table OR undefined_column THEN
      v_por_vencer := 0;
  END;

  RETURN jsonb_build_object(
    'tickets', v_tickets,
    'pedidos', v_pedidos,
    'lotes_vencidos', v_vencidos,
    'lotes_por_vencer', v_por_vencer
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.contar_notificaciones() TO authenticated;

NOTIFY pgrst, 'reload schema';

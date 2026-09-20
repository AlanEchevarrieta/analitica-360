-- Cambios y devoluciones (CRM / inventario).
-- SQL Editor, rol postgres. Pegá TODO y dale Run.

CREATE TABLE IF NOT EXISTS public.devoluciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  usuario_id UUID REFERENCES public.usuarios(id),
  venta_id UUID REFERENCES public.ventas(id),
  numero INT,
  tipo TEXT NOT NULL
    CHECK (tipo IN ('devolucion','cambio')),
  motivo TEXT,
  estado TEXT DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','procesado','cancelado')),
  fecha TIMESTAMPTZ DEFAULT NOW(),
  notas TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.devoluciones_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  devolucion_id UUID NOT NULL REFERENCES public.devoluciones(id),
  producto_id UUID NOT NULL REFERENCES public.productos(id),
  variante_id UUID REFERENCES public.producto_variantes(id),
  cantidad NUMERIC(12,2) NOT NULL,
  precio_unitario NUMERIC(12,2) NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('devuelto','entregado'))
);

ALTER TABLE public.devoluciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devoluciones_items ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.devoluciones TO authenticated;
GRANT SELECT, INSERT ON public.devoluciones_items TO authenticated;

DROP POLICY IF EXISTS empresa_propia ON public.devoluciones;
CREATE POLICY empresa_propia ON public.devoluciones
  FOR ALL TO authenticated
  USING (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

DROP POLICY IF EXISTS empresa_propia ON public.devoluciones_items;
CREATE POLICY empresa_propia ON public.devoluciones_items
  FOR ALL TO authenticated
  USING (
    devolucion_id IN (
      SELECT id FROM public.devoluciones
      WHERE empresa_id = public.get_empresa_id()
    )
  )
  WITH CHECK (
    devolucion_id IN (
      SELECT id FROM public.devoluciones
      WHERE empresa_id = public.get_empresa_id()
    )
  );

CREATE INDEX IF NOT EXISTS idx_devoluciones_empresa
  ON public.devoluciones(empresa_id, fecha DESC)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.registrar_devolucion(
  p_tipo text,
  p_venta_id uuid,
  p_motivo text,
  p_notas text,
  p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_emp uuid := public.get_empresa_id();
  v_user uuid := auth.uid();
  v_id uuid;
  v_n int;
  v_item jsonb;
  v_pid uuid;
  v_vid uuid;
  v_cant numeric;
  v_precio numeric;
  v_tipo text;
BEGIN
  IF v_emp IS NULL OR v_user IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;
  IF p_tipo NOT IN ('devolucion','cambio') THEN
    RAISE EXCEPTION 'TIPO_INVALIDO';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'ITEMS_OBLIGATORIOS';
  END IF;

  SELECT COALESCE(MAX(numero), 0) + 1 INTO v_n
  FROM public.devoluciones
  WHERE empresa_id = v_emp;

  INSERT INTO public.devoluciones (
    empresa_id, usuario_id, venta_id, numero, tipo, motivo, estado, notas
  )
  VALUES (
    v_emp, v_user, p_venta_id, v_n, p_tipo,
    NULLIF(btrim(COALESCE(p_motivo, '')), ''),
    'procesado',
    NULLIF(btrim(COALESCE(p_notas, '')), '')
  )
  RETURNING id INTO v_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_pid := NULLIF(v_item->>'producto_id', '')::uuid;
    v_vid := NULLIF(v_item->>'variante_id', '')::uuid;
    v_cant := COALESCE((v_item->>'cantidad')::numeric, 0);
    v_precio := COALESCE((v_item->>'precio_unitario')::numeric, 0);
    v_tipo := v_item->>'tipo';
    IF v_pid IS NULL OR v_cant <= 0 OR v_tipo NOT IN ('devuelto','entregado') THEN
      RAISE EXCEPTION 'ITEM_INVALIDO';
    END IF;
    IF p_tipo = 'devolucion' AND v_tipo = 'entregado' THEN
      RAISE EXCEPTION 'ITEM_INVALIDO';
    END IF;

    INSERT INTO public.devoluciones_items (
      devolucion_id, producto_id, variante_id, cantidad, precio_unitario, tipo
    ) VALUES (v_id, v_pid, v_vid, v_cant, v_precio, v_tipo);

    INSERT INTO public.movimientos_inventario (
      empresa_id, producto_id, usuario_id, variante_id,
      tipo, signo, cantidad, motivo, precio_unitario, referencia_id
    ) VALUES (
      v_emp, v_pid, v_user, v_vid,
      CASE WHEN v_tipo = 'devuelto' THEN 'devolucion' ELSE 'cambio' END,
      CASE WHEN v_tipo = 'devuelto' THEN 1 ELSE -1 END,
      GREATEST(1, ROUND(v_cant)::int),
      CASE
        WHEN v_tipo = 'devuelto' THEN 'Devolución #' || v_n::text
        ELSE 'Cambio #' || v_n::text
      END,
      v_precio,
      v_id
    );
  END LOOP;

  RETURN v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.registrar_devolucion(text, uuid, text, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancelar_devolucion(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_emp uuid := public.get_empresa_id();
BEGIN
  IF v_emp IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;

  UPDATE public.devoluciones
  SET estado = 'cancelado'
  WHERE id = p_id
    AND empresa_id = v_emp
    AND deleted_at IS NULL
    AND estado = 'pendiente';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DEVOLUCION_INVALIDA';
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.cancelar_devolucion(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

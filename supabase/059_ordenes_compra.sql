-- Órdenes de compra integradas en /compras.
-- SQL Editor, rol postgres. Pegá TODO y dale Run.

CREATE TABLE IF NOT EXISTS public.ordenes_compra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  proveedor_id UUID REFERENCES public.proveedores(id),
  numero_oc TEXT NOT NULL,
  estado TEXT DEFAULT 'borrador'
    CHECK (estado IN (
      'borrador','enviada','confirmada',
      'recibida_parcial','recibida','cancelada'
    )),
  fecha_emision DATE DEFAULT CURRENT_DATE,
  fecha_entrega_estimada DATE,
  notas TEXT,
  total NUMERIC(12,2) DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ordenes_compra_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_compra_id UUID NOT NULL REFERENCES public.ordenes_compra(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES public.productos(id),
  variante_id UUID REFERENCES public.producto_variantes(id),
  cantidad_pedida NUMERIC(12,2) NOT NULL,
  precio_unitario NUMERIC(12,2) NOT NULL,
  cantidad_recibida NUMERIC(12,2) DEFAULT 0,
  recibido BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS public.ordenes_compra_numeracion (
  empresa_id UUID PRIMARY KEY REFERENCES public.empresas(id),
  ultimo BIGINT NOT NULL DEFAULT 0
);

ALTER TABLE public.compras
  ADD COLUMN IF NOT EXISTS orden_compra_id UUID REFERENCES public.ordenes_compra(id);

ALTER TABLE public.ordenes_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordenes_compra_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordenes_compra_numeracion ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.ordenes_compra TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ordenes_compra_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ordenes_compra_numeracion TO authenticated;

DROP POLICY IF EXISTS "empresa_propia" ON public.ordenes_compra;
CREATE POLICY "empresa_propia" ON public.ordenes_compra
  FOR ALL TO authenticated
  USING (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

DROP POLICY IF EXISTS "empresa_propia" ON public.ordenes_compra_items;
CREATE POLICY "empresa_propia" ON public.ordenes_compra_items
  FOR ALL TO authenticated
  USING (
    orden_compra_id IN (
      SELECT id FROM public.ordenes_compra WHERE empresa_id = public.get_empresa_id()
    )
  )
  WITH CHECK (
    orden_compra_id IN (
      SELECT id FROM public.ordenes_compra WHERE empresa_id = public.get_empresa_id()
    )
  );

DROP POLICY IF EXISTS oc_numeracion_select ON public.ordenes_compra_numeracion;
CREATE POLICY oc_numeracion_select ON public.ordenes_compra_numeracion
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_empresa_id());

CREATE OR REPLACE FUNCTION public.formato_numero_oc(p_n bigint)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 'OC-' || lpad(p_n::text, GREATEST(6, length(p_n::text)), '0');
$$;

CREATE OR REPLACE FUNCTION public.asignar_numero_oc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_n bigint;
BEGIN
  IF NEW.numero_oc IS NOT NULL AND btrim(NEW.numero_oc) <> '' THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.ordenes_compra_numeracion (empresa_id, ultimo)
  VALUES (NEW.empresa_id, 1)
  ON CONFLICT (empresa_id) DO UPDATE
    SET ultimo = public.ordenes_compra_numeracion.ultimo + 1
  RETURNING ultimo INTO v_n;
  NEW.numero_oc := public.formato_numero_oc(v_n);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_asignar_numero_oc ON public.ordenes_compra;
CREATE TRIGGER trg_asignar_numero_oc
  BEFORE INSERT ON public.ordenes_compra
  FOR EACH ROW
  EXECUTE PROCEDURE public.asignar_numero_oc();

CREATE OR REPLACE FUNCTION public.touch_ordenes_compra_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_ordenes_compra_updated_at ON public.ordenes_compra;
CREATE TRIGGER trg_ordenes_compra_updated_at
  BEFORE UPDATE ON public.ordenes_compra
  FOR EACH ROW
  EXECUTE PROCEDURE public.touch_ordenes_compra_updated_at();

CREATE INDEX IF NOT EXISTS idx_oc_empresa
  ON public.ordenes_compra(empresa_id, estado, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_oc_numero
  ON public.ordenes_compra(empresa_id, numero_oc)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_oc_items_orden
  ON public.ordenes_compra_items(orden_compra_id);

NOTIFY pgrst, 'reload schema';

-- Pedidos con picking / packing.
-- SQL Editor, rol postgres. Pegá TODO y dale Run.

CREATE TABLE IF NOT EXISTS public.pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  numero_pedido TEXT NOT NULL,
  cliente_id UUID REFERENCES public.clientes(id),
  cliente_nombre TEXT,
  cliente_email TEXT,
  cliente_telefono TEXT,
  origen TEXT DEFAULT 'manual'
    CHECK (origen IN ('manual', 'tienda_online', 'importacion')),
  estado TEXT DEFAULT 'nuevo'
    CHECK (estado IN (
      'nuevo', 'en_preparacion', 'listo_despacho',
      'despachado', 'entregado', 'cancelado'
    )),
  direccion_envio TEXT,
  codigo_postal TEXT,
  localidad TEXT,
  provincia TEXT,
  metodo_envio TEXT,
  numero_seguimiento TEXT,
  transportista TEXT,
  notas TEXT,
  total NUMERIC(12,2),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pedidos_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id),
  producto_id UUID NOT NULL REFERENCES public.productos(id),
  variante_id UUID REFERENCES public.producto_variantes(id),
  lote_id UUID REFERENCES public.lotes(id),
  cantidad NUMERIC(12,2) NOT NULL,
  precio_unitario NUMERIC(12,2) NOT NULL,
  cantidad_preparada NUMERIC(12,2) DEFAULT 0,
  preparado BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS public.pedidos_numeracion (
  empresa_id UUID PRIMARY KEY REFERENCES public.empresas(id),
  ultimo BIGINT NOT NULL DEFAULT 0
);

ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos_numeracion ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.pedidos TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.pedidos_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.pedidos_numeracion TO authenticated;

DROP POLICY IF EXISTS "empresa_propia" ON public.pedidos;
CREATE POLICY "empresa_propia" ON public.pedidos
  FOR ALL TO authenticated
  USING (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

DROP POLICY IF EXISTS "empresa_propia" ON public.pedidos_items;
CREATE POLICY "empresa_propia" ON public.pedidos_items
  FOR ALL TO authenticated
  USING (
    pedido_id IN (
      SELECT id FROM public.pedidos WHERE empresa_id = public.get_empresa_id()
    )
  )
  WITH CHECK (
    pedido_id IN (
      SELECT id FROM public.pedidos WHERE empresa_id = public.get_empresa_id()
    )
  );

DROP POLICY IF EXISTS pedidos_numeracion_select ON public.pedidos_numeracion;
CREATE POLICY pedidos_numeracion_select ON public.pedidos_numeracion
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_empresa_id());

CREATE OR REPLACE FUNCTION public.formato_numero_pedido(p_n bigint)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 'P-' || lpad(p_n::text, GREATEST(6, length(p_n::text)), '0');
$$;

CREATE OR REPLACE FUNCTION public.asignar_numero_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_n bigint;
BEGIN
  IF NEW.numero_pedido IS NOT NULL AND btrim(NEW.numero_pedido) <> '' THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.pedidos_numeracion (empresa_id, ultimo)
  VALUES (NEW.empresa_id, 1)
  ON CONFLICT (empresa_id) DO UPDATE
    SET ultimo = public.pedidos_numeracion.ultimo + 1
  RETURNING ultimo INTO v_n;
  NEW.numero_pedido := public.formato_numero_pedido(v_n);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_asignar_numero_pedido ON public.pedidos;
CREATE TRIGGER trg_asignar_numero_pedido
  BEFORE INSERT ON public.pedidos
  FOR EACH ROW
  EXECUTE PROCEDURE public.asignar_numero_pedido();

CREATE OR REPLACE FUNCTION public.touch_pedidos_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_pedidos_updated_at ON public.pedidos;
CREATE TRIGGER trg_pedidos_updated_at
  BEFORE UPDATE ON public.pedidos
  FOR EACH ROW
  EXECUTE PROCEDURE public.touch_pedidos_updated_at();

CREATE INDEX IF NOT EXISTS idx_pedidos_empresa
  ON public.pedidos(empresa_id, estado, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_numero
  ON public.pedidos(empresa_id, numero_pedido)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pedidos_items_pedido
  ON public.pedidos_items(pedido_id);

-- Historial de mensajes de difusión (CRM / WhatsApp).
-- SQL Editor, rol postgres. Pegá TODO y dale Run.

CREATE TABLE IF NOT EXISTS public.difusiones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  usuario_id UUID REFERENCES public.usuarios(id),
  segmento TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  cantidad_destinatarios INT DEFAULT 0,
  fecha TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.difusiones ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.difusiones TO authenticated;

DROP POLICY IF EXISTS empresa_propia ON public.difusiones;
CREATE POLICY empresa_propia ON public.difusiones
  FOR ALL TO authenticated
  USING (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

NOTIFY pgrst, 'reload schema';

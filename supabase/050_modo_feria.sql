-- Modo feria / venta rápida.
-- SQL Editor, rol postgres. Pegá TODO y dale Run.

ALTER TABLE public.configuracion_empresa
  ADD COLUMN IF NOT EXISTS usa_modo_feria BOOLEAN DEFAULT FALSE;

ALTER TABLE public.configuracion_empresa
  ADD COLUMN IF NOT EXISTS alias_transferencia TEXT;

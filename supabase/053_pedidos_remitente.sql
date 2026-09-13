-- Pedidos: estado con_transportista + datos del remitente.
-- SQL Editor, rol postgres. Pegá TODO y dale Run.

ALTER TABLE public.pedidos DROP CONSTRAINT IF EXISTS pedidos_estado_check;
ALTER TABLE public.pedidos ADD CONSTRAINT pedidos_estado_check
CHECK (estado IN (
  'nuevo', 'en_preparacion', 'listo_despacho',
  'despachado', 'con_transportista', 'entregado', 'cancelado'
));

ALTER TABLE public.configuracion_empresa
  ADD COLUMN IF NOT EXISTS remitente_nombre TEXT;
ALTER TABLE public.configuracion_empresa
  ADD COLUMN IF NOT EXISTS remitente_direccion TEXT;
ALTER TABLE public.configuracion_empresa
  ADD COLUMN IF NOT EXISTS remitente_telefono TEXT;
ALTER TABLE public.configuracion_empresa
  ADD COLUMN IF NOT EXISTS remitente_email TEXT;

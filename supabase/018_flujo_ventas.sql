-- Flujo de ventas (campo cliente). SQL Editor, rol postgres. Pegá TODO y dale Run.

ALTER TABLE public.configuracion_empresa
  ADD COLUMN IF NOT EXISTS flujo_ventas JSONB
  DEFAULT '{"mostrar_cliente":"opcional","crear_desde_venta":true}'::jsonb;

UPDATE public.configuracion_empresa
SET flujo_ventas = '{"mostrar_cliente":"opcional","crear_desde_venta":true}'::jsonb
WHERE flujo_ventas IS NULL;

NOTIFY pgrst, 'reload schema';

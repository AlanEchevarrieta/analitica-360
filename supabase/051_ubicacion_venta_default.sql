-- Ubicación de venta por defecto (opcional; también se guarda en inventario JSON).
ALTER TABLE public.configuracion_empresa
  ADD COLUMN IF NOT EXISTS ubicacion_venta_default TEXT;

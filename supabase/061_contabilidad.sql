-- Contabilidad básica: gastos operativos y configuración fiscal.
-- SQL Editor, rol postgres. Pegá TODO y dale Run.

CREATE TABLE IF NOT EXISTS public.gastos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  usuario_id UUID REFERENCES public.usuarios(id),
  categoria TEXT NOT NULL
    CHECK (categoria IN (
      'alquiler','sueldos','servicios','marketing',
      'logistica','impuestos','mantenimiento','otro'
    )),
  descripcion TEXT NOT NULL,
  monto NUMERIC(12,2) NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  recurrente BOOLEAN DEFAULT FALSE,
  frecuencia TEXT DEFAULT NULL
    CHECK (frecuencia IS NULL OR frecuencia IN ('mensual','quincenal','semanal')),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.gastos TO authenticated;

DROP POLICY IF EXISTS empresa_propia ON public.gastos;
CREATE POLICY empresa_propia ON public.gastos
  FOR ALL TO authenticated
  USING (empresa_id = (
    SELECT u.empresa_id FROM public.usuarios u
    WHERE u.id = auth.uid()
  ))
  WITH CHECK (empresa_id = (
    SELECT u.empresa_id FROM public.usuarios u
    WHERE u.id = auth.uid()
  ));

ALTER TABLE public.configuracion_empresa
  ADD COLUMN IF NOT EXISTS pais TEXT DEFAULT 'argentina';

ALTER TABLE public.configuracion_empresa
  DROP CONSTRAINT IF EXISTS configuracion_empresa_pais_check;
ALTER TABLE public.configuracion_empresa
  ADD CONSTRAINT configuracion_empresa_pais_check
  CHECK (pais IS NULL OR pais IN ('argentina','peru','colombia','otro'));

ALTER TABLE public.configuracion_empresa
  ADD COLUMN IF NOT EXISTS moneda TEXT DEFAULT 'ARS';

ALTER TABLE public.configuracion_empresa
  ADD COLUMN IF NOT EXISTS simbolo_moneda TEXT DEFAULT '$';

ALTER TABLE public.configuracion_empresa
  ADD COLUMN IF NOT EXISTS alicuota_iva NUMERIC(5,2) DEFAULT 21.00;

ALTER TABLE public.configuracion_empresa
  ADD COLUMN IF NOT EXISTS nombre_iva TEXT DEFAULT 'IVA';

ALTER TABLE public.configuracion_empresa
  ADD COLUMN IF NOT EXISTS mostrar_iva_ventas BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_gastos_empresa_fecha
  ON public.gastos(empresa_id, fecha DESC)
  WHERE deleted_at IS NULL;

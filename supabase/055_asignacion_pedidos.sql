-- Asignación automática de pedidos.
-- SQL Editor, rol postgres. Pegá TODO y dale Run.

ALTER TABLE public.configuracion_empresa
  ADD COLUMN IF NOT EXISTS modo_asignacion TEXT DEFAULT 'manual';

ALTER TABLE public.configuracion_empresa
  DROP CONSTRAINT IF EXISTS configuracion_empresa_modo_asignacion_check;

ALTER TABLE public.configuracion_empresa
  ADD CONSTRAINT configuracion_empresa_modo_asignacion_check
  CHECK (modo_asignacion IN ('manual', 'round_robin', 'todo_a_uno'));

ALTER TABLE public.configuracion_empresa
  ADD COLUMN IF NOT EXISTS asignacion_fija_usuario_id UUID REFERENCES public.usuarios(id);

ALTER TABLE public.configuracion_empresa
  ADD COLUMN IF NOT EXISTS asignacion_rotacion_ids UUID[];

UPDATE public.configuracion_empresa
SET modo_asignacion = 'manual'
WHERE modo_asignacion IS NULL;

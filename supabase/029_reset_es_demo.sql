-- Reset de empresas demo: por defecto NO son demo.
-- SQL Editor, rol postgres. Pegá TODO y dale Run.

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS es_demo BOOLEAN DEFAULT FALSE;

ALTER TABLE public.empresas
  ALTER COLUMN es_demo SET DEFAULT FALSE;

UPDATE public.empresas
SET es_demo = FALSE
WHERE es_demo IS NULL OR es_demo = TRUE;

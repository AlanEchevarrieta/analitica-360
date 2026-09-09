-- Auditoría RLS + bloqueo de INSERT en admin_emails.
-- SQL Editor, rol postgres. Pegá TODO y dale Run.

-- 1) Tablas públicas sin RLS (rowsecurity = false)
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Activar RLS en cualquier tabla pública que todavía no lo tenga.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND COALESCE(rowsecurity, false) = false
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

-- 2) Políticas actuales de admin_emails
SELECT *
FROM pg_policies
WHERE tablename = 'admin_emails';

REVOKE INSERT, UPDATE, DELETE ON public.admin_emails FROM anon, authenticated;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_emails'
      AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.admin_emails', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "solo_postgres_inserta"
  ON public.admin_emails
  FOR INSERT
  WITH CHECK (false);

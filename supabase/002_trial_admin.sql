-- Políticas para período de prueba + panel admin.
-- Corré esto en Supabase SQL Editor UNA vez.

GRANT SELECT ON planes TO authenticated;
GRANT SELECT, INSERT ON suscripciones TO authenticated;
GRANT SELECT, INSERT ON aceptaciones_terminos TO authenticated;
GRANT SELECT ON empresas TO authenticated;

DROP POLICY IF EXISTS planes_select ON planes;
CREATE POLICY planes_select ON planes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS suscripciones_select ON suscripciones;
CREATE POLICY suscripciones_select ON suscripciones
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_empresa_id());

DROP POLICY IF EXISTS suscripciones_insert ON suscripciones;
CREATE POLICY suscripciones_insert ON suscripciones
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_empresa_id());

DROP POLICY IF EXISTS aceptaciones_select ON aceptaciones_terminos;
CREATE POLICY aceptaciones_select ON aceptaciones_terminos
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_empresa_id());

DROP POLICY IF EXISTS aceptaciones_insert ON aceptaciones_terminos;
CREATE POLICY aceptaciones_insert ON aceptaciones_terminos
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.get_empresa_id()
    AND usuario_id = auth.uid()
  );

CREATE TABLE IF NOT EXISTS public.admin_emails (
  email TEXT PRIMARY KEY
);

ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.es_admin_app()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM admin_emails a
    JOIN usuarios u ON lower(u.email) = lower(a.email)
    WHERE u.id = auth.uid()
      AND u.deleted_at IS NULL
  );
$$;

GRANT EXECUTE ON FUNCTION public.es_admin_app() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_listar_suscripciones()
RETURNS TABLE (
  suscripcion_id UUID,
  empresa_id UUID,
  empresa_nombre TEXT,
  estado TEXT,
  fecha_vencimiento DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.es_admin_app() THEN
    RAISE EXCEPTION 'NO_AUTORIZADO';
  END IF;

  RETURN QUERY
  SELECT DISTINCT ON (e.id)
    s.id,
    e.id,
    e.nombre,
    s.estado,
    s.fecha_vencimiento
  FROM empresas e
  LEFT JOIN suscripciones s ON s.empresa_id = e.id
  WHERE e.deleted_at IS NULL
  ORDER BY e.id, s.created_at DESC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_listar_suscripciones() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_cambiar_estado_suscripcion(
  p_suscripcion_id UUID,
  p_estado TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.es_admin_app() THEN
    RAISE EXCEPTION 'NO_AUTORIZADO';
  END IF;

  IF p_estado NOT IN ('activa','vencida','cancelada','pendiente_pago','periodo_prueba') THEN
    RAISE EXCEPTION 'ESTADO_INVALIDO';
  END IF;

  UPDATE suscripciones
  SET estado = p_estado
  WHERE id = p_suscripcion_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_cambiar_estado_suscripcion(UUID, TEXT) TO authenticated;

-- Poné acá el mismo email que VITE_ADMIN_EMAIL
-- INSERT INTO admin_emails (email) VALUES ('tu-email@dominio.com')
--   ON CONFLICT (email) DO NOTHING;

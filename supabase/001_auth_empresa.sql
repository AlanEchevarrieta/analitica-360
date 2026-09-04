-- Módulo 1: Auth + alta de empresa
-- Pegá esto en Supabase → SQL Editor → Run
-- Después: Authentication → Providers → Email → desactivar "Confirm email" para probar en local

CREATE TABLE empresas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT NOT NULL,
  rubro       TEXT,
  plan_actual TEXT NOT NULL DEFAULT 'starter'
              CHECK (plan_actual IN ('starter','pro','business')),
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  umbral_confirmacion NUMERIC(12,2),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE TABLE usuarios (
  id          UUID PRIMARY KEY REFERENCES auth.users(id),
  empresa_id  UUID NOT NULL REFERENCES empresas(id),
  nombre      TEXT NOT NULL,
  email       TEXT NOT NULL,
  rol         TEXT NOT NULL DEFAULT 'operador'
              CHECK (rol IN ('dueno','operador','visor')),
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX idx_usuarios_empresa ON usuarios(empresa_id);

CREATE TABLE historial_planes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    UUID NOT NULL REFERENCES empresas(id),
  plan_anterior TEXT,
  plan_nuevo    TEXT NOT NULL,
  fecha_cambio  TIMESTAMPTZ NOT NULL DEFAULT now(),
  motivo        TEXT
);

ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_planes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_empresa_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id FROM usuarios
  WHERE id = auth.uid()
    AND deleted_at IS NULL
    AND activo = TRUE
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_rol()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rol FROM usuarios
  WHERE id = auth.uid()
    AND deleted_at IS NULL
    AND activo = TRUE
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.registrar_empresa(
  p_nombre_empresa TEXT,
  p_rubro TEXT,
  p_nombre_usuario TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_empresa_id UUID;
  v_email TEXT;
  v_nombre TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;

  IF EXISTS (SELECT 1 FROM usuarios WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'YA_TIENE_EMPRESA';
  END IF;

  IF p_nombre_empresa IS NULL OR length(trim(p_nombre_empresa)) = 0 THEN
    RAISE EXCEPTION 'NOMBRE_EMPRESA_OBLIGATORIO';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  v_nombre := NULLIF(trim(coalesce(p_nombre_usuario, '')), '');
  IF v_nombre IS NULL THEN
    v_nombre := trim(p_nombre_empresa);
  END IF;

  INSERT INTO empresas (nombre, rubro)
  VALUES (trim(p_nombre_empresa), NULLIF(trim(coalesce(p_rubro, '')), ''))
  RETURNING id INTO v_empresa_id;

  INSERT INTO usuarios (id, empresa_id, nombre, email, rol)
  VALUES (v_user_id, v_empresa_id, v_nombre, coalesce(v_email, ''), 'dueno');

  INSERT INTO historial_planes (empresa_id, plan_anterior, plan_nuevo, motivo)
  VALUES (v_empresa_id, NULL, 'starter', 'alta inicial');

  RETURN v_empresa_id;
END;
$$;

GRANT SELECT, UPDATE ON empresas TO authenticated;
GRANT SELECT, UPDATE ON usuarios TO authenticated;
GRANT SELECT ON historial_planes TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_empresa_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_rol() TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_empresa(TEXT, TEXT, TEXT) TO authenticated;

CREATE POLICY empresas_select ON empresas
  FOR SELECT USING (id = get_empresa_id());

CREATE POLICY empresas_update ON empresas
  FOR UPDATE USING (
    id = get_empresa_id()
    AND get_rol() = 'dueno'
  );

CREATE POLICY usuarios_select ON usuarios
  FOR SELECT USING (empresa_id = get_empresa_id());

CREATE POLICY usuarios_update ON usuarios
  FOR UPDATE USING (
    empresa_id = get_empresa_id()
    AND get_rol() = 'dueno'
  );

CREATE POLICY historial_planes_select ON historial_planes
  FOR SELECT USING (
    empresa_id = get_empresa_id()
    AND get_rol() = 'dueno'
  );

REVOKE INSERT, DELETE ON empresas FROM anon, authenticated;
REVOKE INSERT, DELETE ON usuarios FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON historial_planes FROM anon, authenticated;

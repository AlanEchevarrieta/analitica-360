-- Equipo: roles, invitaciones y asignación de pedidos.
-- SQL Editor, rol postgres. Pegá TODO y dale Run.

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS rol TEXT DEFAULT 'dueno';

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS invitado_por UUID REFERENCES public.usuarios(id);

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS invitacion_pendiente BOOLEAN DEFAULT FALSE;

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS asignado_a UUID REFERENCES public.usuarios(id);

ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;

UPDATE public.usuarios
SET rol = 'operario'
WHERE rol IN ('operador', 'visor');

UPDATE public.usuarios
SET rol = 'dueno'
WHERE rol IS NULL OR rol = '';

ALTER TABLE public.usuarios
  ADD CONSTRAINT usuarios_rol_check
  CHECK (rol IN ('dueno', 'administrador', 'operario'));

CREATE OR REPLACE FUNCTION public.get_rol()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE rol
    WHEN 'administrador' THEN 'dueno'
    WHEN 'operario' THEN 'operador'
    ELSE rol
  END
  FROM public.usuarios
  WHERE id = auth.uid()
    AND deleted_at IS NULL
    AND activo = TRUE
  LIMIT 1;
$$;

CREATE TABLE IF NOT EXISTS public.invitaciones_colaboradores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  email TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'operario'
    CHECK (rol IN ('administrador', 'operario')),
  invitado_por UUID REFERENCES public.usuarios(id),
  pendiente BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invitaciones_empresa
  ON public.invitaciones_colaboradores (empresa_id, pendiente);

ALTER TABLE public.invitaciones_colaboradores ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.invitaciones_colaboradores TO authenticated;

DROP POLICY IF EXISTS invitaciones_select ON public.invitaciones_colaboradores;
CREATE POLICY invitaciones_select ON public.invitaciones_colaboradores
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_empresa_id());

DROP POLICY IF EXISTS invitaciones_insert ON public.invitaciones_colaboradores;
CREATE POLICY invitaciones_insert ON public.invitaciones_colaboradores
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.get_empresa_id()
    AND public.get_rol() = 'dueno'
  );

DROP POLICY IF EXISTS invitaciones_update ON public.invitaciones_colaboradores;
CREATE POLICY invitaciones_update ON public.invitaciones_colaboradores
  FOR UPDATE TO authenticated
  USING (
    empresa_id = public.get_empresa_id()
    AND public.get_rol() = 'dueno'
  );

CREATE OR REPLACE FUNCTION public.invitar_colaborador(
  p_email text,
  p_rol text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
  v_email text;
  v_rol text;
  v_id uuid;
BEGIN
  v_empresa := public.get_empresa_id();
  IF v_empresa IS NULL OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;
  IF public.get_rol() <> 'dueno' THEN
    RAISE EXCEPTION 'NO_AUTORIZADO';
  END IF;

  v_email := lower(trim(coalesce(p_email, '')));
  IF v_email IS NULL OR v_email !~ '^[^@]+@[^@]+\.[^@]+$' THEN
    RAISE EXCEPTION 'EMAIL_INVALIDO';
  END IF;

  v_rol := lower(trim(coalesce(p_rol, 'operario')));
  IF v_rol NOT IN ('administrador', 'operario') THEN
    RAISE EXCEPTION 'ROL_INVALIDO';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.empresa_id = v_empresa
      AND lower(u.email) = v_email
      AND u.deleted_at IS NULL
      AND u.activo = TRUE
  ) THEN
    RAISE EXCEPTION 'EMAIL_YA_REGISTRADO';
  END IF;

  UPDATE public.invitaciones_colaboradores
  SET pendiente = FALSE
  WHERE empresa_id = v_empresa
    AND lower(email) = v_email
    AND pendiente = TRUE;

  INSERT INTO public.invitaciones_colaboradores (empresa_id, email, rol, invitado_por, pendiente)
  VALUES (v_empresa, v_email, v_rol, auth.uid(), TRUE)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.invitar_colaborador(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.aceptar_invitacion_colaborador(
  p_empresa uuid,
  p_rol text,
  p_nombre text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_user uuid;
  v_email text;
  v_rol text;
  v_nombre text;
  v_inv record;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;

  SELECT lower(email) INTO v_email FROM auth.users WHERE id = v_user;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'EMAIL_INVALIDO';
  END IF;

  IF EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = v_user AND u.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'YA_TIENE_EMPRESA';
  END IF;

  v_rol := lower(trim(coalesce(p_rol, 'operario')));
  IF v_rol NOT IN ('administrador', 'operario') THEN
    v_rol := 'operario';
  END IF;

  v_nombre := nullif(trim(coalesce(p_nombre, '')), '');
  IF v_nombre IS NULL THEN
    v_nombre := split_part(v_email, '@', 1);
  END IF;

  SELECT * INTO v_inv
  FROM public.invitaciones_colaboradores i
  WHERE i.empresa_id = p_empresa
    AND i.pendiente = TRUE
    AND lower(i.email) = v_email
  ORDER BY i.created_at DESC
  LIMIT 1;

  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'INVITACION_INVALIDA';
  END IF;

  v_rol := v_inv.rol;

  INSERT INTO public.usuarios (
    id, empresa_id, nombre, email, rol, activo, invitado_por, invitacion_pendiente, permisos
  ) VALUES (
    v_user,
    v_inv.empresa_id,
    v_nombre,
    v_email,
    v_rol,
    TRUE,
    v_inv.invitado_por,
    FALSE,
    CASE
      WHEN v_rol = 'administrador' THEN '{
        "registrar_ventas": true,
        "ver_historial": true,
        "editar_productos": true,
        "ver_costos": true,
        "ajustar_stock": true,
        "ver_reportes": true,
        "anular_ventas": true
      }'::jsonb
      ELSE '{
        "registrar_ventas": true,
        "ver_historial": true,
        "editar_productos": false,
        "ver_costos": false,
        "ajustar_stock": false,
        "ver_reportes": false,
        "anular_ventas": false
      }'::jsonb
    END
  );

  UPDATE public.invitaciones_colaboradores
  SET pendiente = FALSE
  WHERE id = v_inv.id;

  RETURN v_user;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.aceptar_invitacion_colaborador(uuid, text, text) TO authenticated;

DROP POLICY IF EXISTS usuarios_insert ON public.usuarios;
CREATE POLICY usuarios_insert ON public.usuarios
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.get_empresa_id()
    AND public.get_rol() = 'dueno'
    AND rol IN ('administrador', 'operario', 'operador', 'visor')
  );

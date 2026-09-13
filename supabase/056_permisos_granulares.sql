-- Permisos granulares por colaborador.
-- SQL Editor, rol postgres. Pegá TODO y dale Run.

CREATE TABLE IF NOT EXISTS public.colaborador_permisos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id),
  modulos JSONB DEFAULT '{}',
  acciones JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (empresa_id, usuario_id)
);

ALTER TABLE public.colaborador_permisos ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.colaborador_permisos TO authenticated;

DROP POLICY IF EXISTS "empresa_propia" ON public.colaborador_permisos;
CREATE POLICY "empresa_propia" ON public.colaborador_permisos
  FOR ALL TO authenticated
  USING (
    empresa_id = (
      SELECT empresa_id FROM public.usuarios
      WHERE id = auth.uid()
        AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    empresa_id = (
      SELECT empresa_id FROM public.usuarios
      WHERE id = auth.uid()
        AND deleted_at IS NULL
    )
    AND public.get_rol() = 'dueno'
  );

ALTER TABLE public.invitaciones_colaboradores
  ADD COLUMN IF NOT EXISTS modulos JSONB DEFAULT '{}';

ALTER TABLE public.invitaciones_colaboradores
  ADD COLUMN IF NOT EXISTS acciones JSONB DEFAULT '{}';

DROP FUNCTION IF EXISTS public.invitar_colaborador(text, text);

CREATE OR REPLACE FUNCTION public.invitar_colaborador(
  p_email text,
  p_modulos jsonb,
  p_acciones jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
  v_email text;
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

  INSERT INTO public.invitaciones_colaboradores (
    empresa_id, email, rol, invitado_por, pendiente, modulos, acciones
  ) VALUES (
    v_empresa,
    v_email,
    'operario',
    auth.uid(),
    TRUE,
    coalesce(p_modulos, '{}'::jsonb),
    coalesce(p_acciones, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.invitar_colaborador(text, jsonb, jsonb) TO authenticated;

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

  v_rol := 'operario';
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

  INSERT INTO public.usuarios (
    id, empresa_id, nombre, email, rol, activo, invitado_por, invitacion_pendiente
  ) VALUES (
    v_user,
    v_inv.empresa_id,
    v_nombre,
    v_email,
    v_rol,
    TRUE,
    v_inv.invitado_por,
    FALSE
  );

  INSERT INTO public.colaborador_permisos (empresa_id, usuario_id, modulos, acciones)
  VALUES (
    v_inv.empresa_id,
    v_user,
    coalesce(v_inv.modulos, '{}'::jsonb),
    coalesce(v_inv.acciones, '{}'::jsonb)
  )
  ON CONFLICT (empresa_id, usuario_id)
  DO UPDATE SET
    modulos = excluded.modulos,
    acciones = excluded.acciones,
    updated_at = NOW();

  UPDATE public.invitaciones_colaboradores
  SET pendiente = FALSE
  WHERE id = v_inv.id;

  RETURN v_user;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.aceptar_invitacion_colaborador(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.guardar_colaborador_permisos(
  p_usuario uuid,
  p_modulos jsonb,
  p_acciones jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
BEGIN
  v_empresa := public.get_empresa_id();
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;
  IF public.get_rol() <> 'dueno' THEN
    RAISE EXCEPTION 'NO_AUTORIZADO';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = p_usuario
      AND u.empresa_id = v_empresa
      AND u.deleted_at IS NULL
      AND u.rol <> 'dueno'
  ) THEN
    RAISE EXCEPTION 'USUARIO_INVALIDO';
  END IF;

  INSERT INTO public.colaborador_permisos (empresa_id, usuario_id, modulos, acciones)
  VALUES (v_empresa, p_usuario, coalesce(p_modulos, '{}'::jsonb), coalesce(p_acciones, '{}'::jsonb))
  ON CONFLICT (empresa_id, usuario_id)
  DO UPDATE SET
    modulos = excluded.modulos,
    acciones = excluded.acciones,
    updated_at = NOW();
END;
$function$;

GRANT EXECUTE ON FUNCTION public.guardar_colaborador_permisos(uuid, jsonb, jsonb) TO authenticated;

ALTER TABLE public.colaborador_permisos REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.colaborador_permisos;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;


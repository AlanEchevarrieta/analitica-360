-- Alta de empleados sin Edge Function ni signUp en el cliente
-- (signUp en el browser cerraría la sesión del dueño).
-- Pegá TODO el archivo en el SQL Editor y dale Run.

CREATE OR REPLACE FUNCTION public.crear_usuario_empresa(
  p_nombre text,
  p_email text,
  p_password text,
  p_rol text,
  p_permisos jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, auth, extensions
AS $function$
DECLARE
  v_empresa uuid;
  v_id uuid := gen_random_uuid();
  v_email text;
  v_nombre text;
  v_rol text;
BEGIN
  v_empresa := public.get_empresa_id();
  IF v_empresa IS NULL OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;
  IF public.get_rol() <> 'dueno' THEN
    RAISE EXCEPTION 'NO_AUTORIZADO';
  END IF;

  v_nombre := nullif(trim(coalesce(p_nombre, '')), '');
  v_email := lower(trim(coalesce(p_email, '')));
  IF v_nombre IS NULL THEN
    RAISE EXCEPTION 'NOMBRE_OBLIGATORIO';
  END IF;
  IF v_email IS NULL OR v_email !~ '^[^@]+@[^@]+\.[^@]+$' THEN
    RAISE EXCEPTION 'EMAIL_INVALIDO';
  END IF;
  IF p_password IS NULL OR length(p_password) < 8 THEN
    RAISE EXCEPTION 'PASSWORD_INVALIDA';
  END IF;

  v_rol := lower(trim(coalesce(p_rol, 'operador')));
  IF v_rol NOT IN ('operador', 'visor') THEN
    RAISE EXCEPTION 'ROL_INVALIDO';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = v_email) THEN
    RAISE EXCEPTION 'EMAIL_YA_REGISTRADO';
  END IF;
  IF EXISTS (SELECT 1 FROM public.usuarios u WHERE lower(u.email) = v_email AND u.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'EMAIL_YA_REGISTRADO';
  END IF;

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_id,
    'authenticated',
    'authenticated',
    v_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('nombre', v_nombre),
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_id,
    jsonb_build_object('sub', v_id::text, 'email', v_email),
    'email',
    v_email,
    now(),
    now(),
    now()
  );

  INSERT INTO public.usuarios (id, empresa_id, nombre, email, rol, activo, permisos)
  VALUES (
    v_id,
    v_empresa,
    v_nombre,
    v_email,
    v_rol,
    TRUE,
    coalesce(p_permisos, '{}'::jsonb)
  );

  RETURN v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.crear_usuario_empresa(text, text, text, text, jsonb) TO authenticated;

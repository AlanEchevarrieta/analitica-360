-- Configuración de empresa (medios de pago y tasas de cuotas).
-- Pegá TODO el archivo en el SQL Editor y dale Run.

CREATE TABLE IF NOT EXISTS public.configuracion_empresa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  medios_pago JSONB DEFAULT '["efectivo","transferencia","debito","credito","mp_qr"]',
  tasas_cuotas JSONB DEFAULT '[
    {"cuotas":1,"label":"1 cuota","tasa":0,"activo":true},
    {"cuotas":3,"label":"3 cuotas","tasa":0,"activo":true},
    {"cuotas":6,"label":"6 cuotas","tasa":15,"activo":true},
    {"cuotas":9,"label":"9 cuotas","tasa":25,"activo":true},
    {"cuotas":12,"label":"12 cuotas","tasa":45,"activo":true},
    {"cuotas":18,"label":"18 cuotas","tasa":70,"activo":false},
    {"cuotas":24,"label":"24 cuotas","tasa":95,"activo":false},
    {"cuotas":0,"label":"Plan Z","tasa":0,"activo":false}
  ]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empresa_id)
);

ALTER TABLE public.configuracion_empresa ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.configuracion_empresa TO authenticated;

DROP POLICY IF EXISTS empresa_propia ON public.configuracion_empresa;
DROP POLICY IF EXISTS configuracion_select ON public.configuracion_empresa;
DROP POLICY IF EXISTS configuracion_insert ON public.configuracion_empresa;
DROP POLICY IF EXISTS configuracion_update ON public.configuracion_empresa;

-- usuarios.id = auth.uid() (no hay columna auth_id). Lectura para toda la empresa (ventas);
-- escritura solo dueño.
CREATE POLICY configuracion_select ON public.configuracion_empresa
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_empresa_id());

CREATE POLICY configuracion_insert ON public.configuracion_empresa
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.get_empresa_id()
    AND public.get_rol() = 'dueno'
  );

CREATE POLICY configuracion_update ON public.configuracion_empresa
  FOR UPDATE TO authenticated
  USING (
    empresa_id = public.get_empresa_id()
    AND public.get_rol() = 'dueno'
  )
  WITH CHECK (
    empresa_id = public.get_empresa_id()
    AND public.get_rol() = 'dueno'
  );

INSERT INTO public.configuracion_empresa (empresa_id)
SELECT e.id
FROM public.empresas e
WHERE e.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.configuracion_empresa c WHERE c.empresa_id = e.id
  );

CREATE OR REPLACE FUNCTION public.registrar_empresa(
  p_nombre_empresa text,
  p_rubro text,
  p_nombre_usuario text,
  p_user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_user_id uuid;
  v_empresa_id uuid;
  v_email text;
  v_nombre text;
  v_plan_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;

  IF EXISTS (SELECT 1 FROM public.usuarios WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'YA_TIENE_EMPRESA';
  END IF;

  IF p_nombre_empresa IS NULL OR length(trim(p_nombre_empresa)) = 0 THEN
    RAISE EXCEPTION 'NOMBRE_EMPRESA_OBLIGATORIO';
  END IF;

  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_user_id;

  v_nombre := nullif(trim(coalesce(p_nombre_usuario, '')), '');
  IF v_nombre IS NULL THEN
    v_nombre := trim(p_nombre_empresa);
  END IF;

  INSERT INTO public.empresas (nombre, rubro)
  VALUES (trim(p_nombre_empresa), nullif(trim(coalesce(p_rubro, '')), ''))
  RETURNING id INTO v_empresa_id;

  INSERT INTO public.usuarios (id, empresa_id, nombre, email, rol)
  VALUES (v_user_id, v_empresa_id, v_nombre, coalesce(v_email, ''), 'dueno');

  INSERT INTO public.historial_planes (empresa_id, plan_anterior, plan_nuevo, motivo)
  VALUES (v_empresa_id, NULL, 'starter', 'alta inicial');

  INSERT INTO public.configuracion_empresa (empresa_id)
  VALUES (v_empresa_id);

  SELECT p.id INTO v_plan_id
  FROM public.planes p
  WHERE lower(p.nombre) = 'starter'
  ORDER BY p.created_at
  LIMIT 1;

  IF v_plan_id IS NOT NULL THEN
    INSERT INTO public.suscripciones (
      empresa_id,
      plan_id,
      estado,
      fecha_inicio,
      fecha_vencimiento
    ) VALUES (
      v_empresa_id,
      v_plan_id,
      'periodo_prueba',
      CURRENT_DATE,
      (CURRENT_DATE + interval '14 days')::date
    );
  END IF;

  INSERT INTO public.aceptaciones_terminos (empresa_id, usuario_id, version, user_agent)
  VALUES (
    v_empresa_id,
    v_user_id,
    '1.0',
    nullif(trim(coalesce(p_user_agent, '')), '')
  );

  RETURN v_empresa_id;
END;
$function$;

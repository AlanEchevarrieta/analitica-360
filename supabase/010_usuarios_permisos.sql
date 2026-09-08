-- Permisos de usuarios + invitación.
-- Pegá TODO el archivo en el SQL Editor y dale Run.

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS permisos JSONB DEFAULT '{
    "registrar_ventas": true,
    "ver_historial": true,
    "editar_productos": false,
    "ver_costos": false,
    "ajustar_stock": false,
    "ver_reportes": false,
    "anular_ventas": false
  }'::jsonb;

UPDATE public.usuarios
SET permisos = '{
  "registrar_ventas": true,
  "ver_historial": true,
  "editar_productos": true,
  "ver_costos": true,
  "ajustar_stock": true,
  "ver_reportes": true,
  "anular_ventas": true
}'::jsonb
WHERE rol = 'dueno'
  AND (permisos IS NULL OR permisos = '{
    "registrar_ventas": true,
    "ver_historial": true,
    "editar_productos": false,
    "ver_costos": false,
    "ajustar_stock": false,
    "ver_reportes": false,
    "anular_ventas": false
  }'::jsonb);

GRANT INSERT ON public.usuarios TO authenticated;

DROP POLICY IF EXISTS usuarios_insert ON public.usuarios;
CREATE POLICY usuarios_insert ON public.usuarios
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.get_empresa_id()
    AND public.get_rol() = 'dueno'
    AND rol IN ('operador', 'visor')
  );

CREATE OR REPLACE FUNCTION public.anular_venta(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
  v_rol text;
  v_permisos jsonb;
BEGIN
  v_empresa := public.get_empresa_id();
  v_rol := public.get_rol();
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;
  IF v_rol = 'dueno' THEN
    NULL;
  ELSIF v_rol = 'operador' THEN
    SELECT u.permisos INTO v_permisos
    FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND u.empresa_id = v_empresa
      AND u.deleted_at IS NULL;
    IF COALESCE((v_permisos->>'anular_ventas')::boolean, FALSE) IS NOT TRUE THEN
      RAISE EXCEPTION 'NO_AUTORIZADO';
    END IF;
  ELSE
    RAISE EXCEPTION 'NO_AUTORIZADO';
  END IF;

  UPDATE public.ventas
  SET deleted_at = now()
  WHERE id = p_id
    AND empresa_id = v_empresa
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VENTA_INVALIDA';
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.anular_venta(uuid) TO authenticated;

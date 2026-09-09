-- Campos fiscales/comerciales de proveedores + RPCs.
-- SQL Editor, rol postgres. Pegá TODO y dale Run.
-- Si ya corriste 022, este archivo alcanza. No toca Analytics ni ventas.

ALTER TABLE public.proveedores ADD COLUMN IF NOT EXISTS razon_social TEXT;
ALTER TABLE public.proveedores ADD COLUMN IF NOT EXISTS nombre_comercial TEXT;
ALTER TABLE public.proveedores ADD COLUMN IF NOT EXISTS cuit TEXT;
ALTER TABLE public.proveedores ADD COLUMN IF NOT EXISTS condicion_afip TEXT;
ALTER TABLE public.proveedores ADD COLUMN IF NOT EXISTS nombre_vendedor TEXT;
ALTER TABLE public.proveedores ADD COLUMN IF NOT EXISTS condiciones_pago TEXT;
ALTER TABLE public.proveedores ADD COLUMN IF NOT EXISTS formas_pago_aceptadas TEXT[];
ALTER TABLE public.proveedores ADD COLUMN IF NOT EXISTS plazo_entrega TEXT;
ALTER TABLE public.proveedores ADD COLUMN IF NOT EXISTS cbu TEXT;
ALTER TABLE public.proveedores ADD COLUMN IF NOT EXISTS alias_cbu TEXT;
ALTER TABLE public.proveedores ADD COLUMN IF NOT EXISTS banco TEXT;

UPDATE public.proveedores
SET razon_social = nombre
WHERE (razon_social IS NULL OR length(trim(razon_social)) = 0)
  AND nombre IS NOT NULL;

UPDATE public.proveedores
SET nombre_vendedor = contacto
WHERE (nombre_vendedor IS NULL OR length(trim(nombre_vendedor)) = 0)
  AND contacto IS NOT NULL;

DROP FUNCTION IF EXISTS public.crear_proveedor(text, text, text, text, text, text, text, boolean);
DROP FUNCTION IF EXISTS public.actualizar_proveedor(uuid, text, text, text, text, text, text, text, boolean);
DROP FUNCTION IF EXISTS public.crear_proveedor(jsonb);
DROP FUNCTION IF EXISTS public.actualizar_proveedor(uuid, jsonb);

CREATE OR REPLACE FUNCTION public.crear_proveedor(p_datos jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
  v_id uuid;
  v_razon text;
  v_formas text[];
BEGIN
  v_empresa := public.get_empresa_id();
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;
  IF public.get_rol() NOT IN ('dueno', 'operador') THEN
    RAISE EXCEPTION 'NO_AUTORIZADO';
  END IF;

  v_razon := trim(coalesce(p_datos->>'razon_social', p_datos->>'nombre', ''));
  IF length(v_razon) = 0 THEN
    RAISE EXCEPTION 'NOMBRE_OBLIGATORIO';
  END IF;

  IF jsonb_typeof(p_datos->'formas_pago_aceptadas') = 'array' THEN
    SELECT array_agg(x) INTO v_formas
    FROM (
      SELECT nullif(trim(value), '') AS x
      FROM jsonb_array_elements_text(p_datos->'formas_pago_aceptadas')
    ) s
    WHERE x IS NOT NULL;
  END IF;

  INSERT INTO public.proveedores (
    empresa_id, nombre, contacto, telefono, email,
    productos_que_provee, condiciones_pago, notas, activo,
    razon_social, nombre_comercial, cuit, condicion_afip, nombre_vendedor,
    formas_pago_aceptadas, plazo_entrega, cbu, alias_cbu, banco
  ) VALUES (
    v_empresa,
    v_razon,
    nullif(trim(coalesce(p_datos->>'nombre_vendedor', '')), ''),
    nullif(trim(coalesce(p_datos->>'telefono', '')), ''),
    nullif(trim(coalesce(p_datos->>'email', '')), ''),
    nullif(trim(coalesce(p_datos->>'productos_que_provee', '')), ''),
    nullif(trim(coalesce(p_datos->>'condiciones_pago', '')), ''),
    nullif(trim(coalesce(p_datos->>'notas', '')), ''),
    COALESCE((p_datos->>'activo')::boolean, TRUE),
    v_razon,
    nullif(trim(coalesce(p_datos->>'nombre_comercial', '')), ''),
    nullif(trim(coalesce(p_datos->>'cuit', '')), ''),
    nullif(trim(coalesce(p_datos->>'condicion_afip', '')), ''),
    nullif(trim(coalesce(p_datos->>'nombre_vendedor', '')), ''),
    v_formas,
    nullif(trim(coalesce(p_datos->>'plazo_entrega', '')), ''),
    nullif(trim(coalesce(p_datos->>'cbu', '')), ''),
    nullif(trim(coalesce(p_datos->>'alias_cbu', '')), ''),
    nullif(trim(coalesce(p_datos->>'banco', '')), '')
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.crear_proveedor(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.actualizar_proveedor(p_id uuid, p_datos jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
  v_razon text;
  v_formas text[];
BEGIN
  v_empresa := public.get_empresa_id();
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;
  IF public.get_rol() NOT IN ('dueno', 'operador') THEN
    RAISE EXCEPTION 'NO_AUTORIZADO';
  END IF;

  v_razon := trim(coalesce(p_datos->>'razon_social', p_datos->>'nombre', ''));
  IF length(v_razon) = 0 THEN
    RAISE EXCEPTION 'NOMBRE_OBLIGATORIO';
  END IF;

  IF jsonb_typeof(p_datos->'formas_pago_aceptadas') = 'array' THEN
    SELECT array_agg(x) INTO v_formas
    FROM (
      SELECT nullif(trim(value), '') AS x
      FROM jsonb_array_elements_text(p_datos->'formas_pago_aceptadas')
    ) s
    WHERE x IS NOT NULL;
  END IF;

  UPDATE public.proveedores
  SET
    nombre = v_razon,
    contacto = nullif(trim(coalesce(p_datos->>'nombre_vendedor', '')), ''),
    telefono = nullif(trim(coalesce(p_datos->>'telefono', '')), ''),
    email = nullif(trim(coalesce(p_datos->>'email', '')), ''),
    productos_que_provee = nullif(trim(coalesce(p_datos->>'productos_que_provee', '')), ''),
    condiciones_pago = nullif(trim(coalesce(p_datos->>'condiciones_pago', '')), ''),
    notas = nullif(trim(coalesce(p_datos->>'notas', '')), ''),
    activo = COALESCE((p_datos->>'activo')::boolean, TRUE),
    razon_social = v_razon,
    nombre_comercial = nullif(trim(coalesce(p_datos->>'nombre_comercial', '')), ''),
    cuit = nullif(trim(coalesce(p_datos->>'cuit', '')), ''),
    condicion_afip = nullif(trim(coalesce(p_datos->>'condicion_afip', '')), ''),
    nombre_vendedor = nullif(trim(coalesce(p_datos->>'nombre_vendedor', '')), ''),
    formas_pago_aceptadas = v_formas,
    plazo_entrega = nullif(trim(coalesce(p_datos->>'plazo_entrega', '')), ''),
    cbu = nullif(trim(coalesce(p_datos->>'cbu', '')), ''),
    alias_cbu = nullif(trim(coalesce(p_datos->>'alias_cbu', '')), ''),
    banco = nullif(trim(coalesce(p_datos->>'banco', '')), '')
  WHERE id = p_id AND empresa_id = v_empresa AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROVEEDOR_INVALIDO';
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.actualizar_proveedor(uuid, jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';

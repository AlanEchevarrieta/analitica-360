-- OCR de facturas de compra: imagen en Storage y URL en compras.
-- SQL Editor, rol postgres. Pegá TODO y dale Run.

ALTER TABLE public.compras
  ADD COLUMN IF NOT EXISTS imagen_factura_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('facturas', 'facturas', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS facturas_select ON storage.objects;
CREATE POLICY facturas_select ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'facturas');

DROP POLICY IF EXISTS facturas_insert ON storage.objects;
CREATE POLICY facturas_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'facturas'
    AND (storage.foldername(name))[1] = public.get_empresa_id()::text
  );

DROP POLICY IF EXISTS facturas_update ON storage.objects;
CREATE POLICY facturas_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'facturas'
    AND (storage.foldername(name))[1] = public.get_empresa_id()::text
  );

CREATE OR REPLACE FUNCTION public.guardar_imagen_factura(p_id uuid, p_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_emp uuid := public.get_empresa_id();
BEGIN
  IF v_emp IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;
  IF public.get_rol() NOT IN ('dueno', 'operador') THEN
    RAISE EXCEPTION 'NO_AUTORIZADO';
  END IF;
  IF p_url IS NULL OR trim(p_url) = '' THEN
    RAISE EXCEPTION 'URL_INVALIDA';
  END IF;

  UPDATE public.compras
  SET imagen_factura_url = trim(p_url)
  WHERE id = p_id AND empresa_id = v_emp AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COMPRA_INVALIDA';
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.guardar_imagen_factura(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

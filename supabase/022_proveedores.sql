-- Módulo Proveedores + vínculo con compras + ajuste de stock.
-- SQL Editor, rol postgres. Pegá TODO y dale Run.

CREATE TABLE IF NOT EXISTS public.proveedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  nombre TEXT NOT NULL,
  contacto TEXT,
  telefono TEXT,
  email TEXT,
  productos_que_provee TEXT,
  condiciones_pago TEXT,
  notas TEXT,
  activo BOOLEAN DEFAULT TRUE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proveedores_empresa_nombre
  ON public.proveedores(empresa_id, nombre);

ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.proveedores TO authenticated;

DROP POLICY IF EXISTS proveedores_select ON public.proveedores;
CREATE POLICY proveedores_select ON public.proveedores
  FOR SELECT USING (empresa_id = public.get_empresa_id() AND deleted_at IS NULL);

DROP POLICY IF EXISTS proveedores_insert ON public.proveedores;
CREATE POLICY proveedores_insert ON public.proveedores
  FOR INSERT WITH CHECK (
    empresa_id = public.get_empresa_id()
    AND public.get_rol() IN ('dueno', 'operador')
  );

DROP POLICY IF EXISTS proveedores_update ON public.proveedores;
CREATE POLICY proveedores_update ON public.proveedores
  FOR UPDATE USING (
    empresa_id = public.get_empresa_id()
    AND public.get_rol() IN ('dueno', 'operador')
  );

ALTER TABLE public.compras
  ADD COLUMN IF NOT EXISTS proveedor_id UUID REFERENCES public.proveedores(id);

CREATE OR REPLACE FUNCTION public.crear_proveedor(
  p_nombre text,
  p_contacto text DEFAULT NULL,
  p_telefono text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_productos_que_provee text DEFAULT NULL,
  p_condiciones_pago text DEFAULT NULL,
  p_notas text DEFAULT NULL,
  p_activo boolean DEFAULT TRUE
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
  v_id uuid;
BEGIN
  v_empresa := public.get_empresa_id();
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;
  IF public.get_rol() NOT IN ('dueno', 'operador') THEN
    RAISE EXCEPTION 'NO_AUTORIZADO';
  END IF;
  IF p_nombre IS NULL OR length(trim(p_nombre)) = 0 THEN
    RAISE EXCEPTION 'NOMBRE_OBLIGATORIO';
  END IF;

  INSERT INTO public.proveedores (
    empresa_id, nombre, contacto, telefono, email,
    productos_que_provee, condiciones_pago, notas, activo
  ) VALUES (
    v_empresa,
    trim(p_nombre),
    nullif(trim(coalesce(p_contacto, '')), ''),
    nullif(trim(coalesce(p_telefono, '')), ''),
    nullif(trim(coalesce(p_email, '')), ''),
    nullif(trim(coalesce(p_productos_que_provee, '')), ''),
    nullif(trim(coalesce(p_condiciones_pago, '')), ''),
    nullif(trim(coalesce(p_notas, '')), ''),
    COALESCE(p_activo, TRUE)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.crear_proveedor(text, text, text, text, text, text, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.actualizar_proveedor(
  p_id uuid,
  p_nombre text,
  p_contacto text DEFAULT NULL,
  p_telefono text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_productos_que_provee text DEFAULT NULL,
  p_condiciones_pago text DEFAULT NULL,
  p_notas text DEFAULT NULL,
  p_activo boolean DEFAULT TRUE
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
  IF public.get_rol() NOT IN ('dueno', 'operador') THEN
    RAISE EXCEPTION 'NO_AUTORIZADO';
  END IF;
  IF p_nombre IS NULL OR length(trim(p_nombre)) = 0 THEN
    RAISE EXCEPTION 'NOMBRE_OBLIGATORIO';
  END IF;

  UPDATE public.proveedores
  SET
    nombre = trim(p_nombre),
    contacto = nullif(trim(coalesce(p_contacto, '')), ''),
    telefono = nullif(trim(coalesce(p_telefono, '')), ''),
    email = nullif(trim(coalesce(p_email, '')), ''),
    productos_que_provee = nullif(trim(coalesce(p_productos_que_provee, '')), ''),
    condiciones_pago = nullif(trim(coalesce(p_condiciones_pago, '')), ''),
    notas = nullif(trim(coalesce(p_notas, '')), ''),
    activo = COALESCE(p_activo, TRUE)
  WHERE id = p_id AND empresa_id = v_empresa AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROVEEDOR_INVALIDO';
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.actualizar_proveedor(uuid, text, text, text, text, text, text, text, boolean) TO authenticated;

DROP FUNCTION IF EXISTS public.confirmar_compra(jsonb, text, date, text);
DROP FUNCTION IF EXISTS public.confirmar_compra(jsonb, text, date, text, uuid);

CREATE OR REPLACE FUNCTION public.confirmar_compra(
  p_items jsonb,
  p_proveedor text,
  p_fecha date,
  p_notas text,
  p_proveedor_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
  v_user uuid := auth.uid();
  v_compra uuid;
  v_item jsonb;
  v_producto uuid;
  v_nombre text;
  v_cantidad integer;
  v_costo numeric;
  v_subtotal numeric;
  v_total numeric := 0;
  v_precio numeric;
  v_prov_id uuid;
  v_prov_nombre text;
BEGIN
  v_empresa := public.get_empresa_id();
  IF v_empresa IS NULL OR v_user IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;
  IF public.get_rol() NOT IN ('dueno', 'operador') THEN
    RAISE EXCEPTION 'NO_AUTORIZADO';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'SIN_PRODUCTOS';
  END IF;
  IF p_fecha IS NULL THEN
    RAISE EXCEPTION 'FECHA_INVALIDA';
  END IF;

  v_prov_nombre := nullif(trim(coalesce(p_proveedor, '')), '');
  v_prov_id := p_proveedor_id;
  IF v_prov_id IS NOT NULL THEN
    SELECT pr.nombre INTO v_prov_nombre
    FROM public.proveedores pr
    WHERE pr.id = v_prov_id AND pr.empresa_id = v_empresa AND pr.deleted_at IS NULL;
    IF v_prov_nombre IS NULL THEN
      RAISE EXCEPTION 'PROVEEDOR_INVALIDO';
    END IF;
  END IF;

  INSERT INTO public.compras (
    empresa_id, usuario_id, proveedor, proveedor_id, fecha, total, notas
  ) VALUES (
    v_empresa,
    v_user,
    v_prov_nombre,
    v_prov_id,
    p_fecha,
    0,
    nullif(trim(coalesce(p_notas, '')), '')
  )
  RETURNING id INTO v_compra;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_producto := (v_item->>'producto_id')::uuid;
    v_nombre := trim(coalesce(v_item->>'producto_nombre', ''));
    v_cantidad := (v_item->>'cantidad')::integer;
    v_costo := (v_item->>'costo_unitario')::numeric;

    IF v_producto IS NULL OR v_cantidad IS NULL OR v_cantidad <= 0 OR v_costo IS NULL OR v_costo < 0 THEN
      RAISE EXCEPTION 'ITEM_INVALIDO';
    END IF;

    SELECT p.nombre INTO v_nombre
    FROM public.productos p
    WHERE p.id = v_producto
      AND p.empresa_id = v_empresa
      AND p.deleted_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'PRODUCTO_INVALIDO';
    END IF;

    v_subtotal := round(v_cantidad * v_costo, 2);
    v_total := v_total + v_subtotal;

    INSERT INTO public.compras_items (
      compra_id, empresa_id, producto_id, producto_nombre, cantidad, costo_unitario, subtotal
    ) VALUES (
      v_compra, v_empresa, v_producto, v_nombre, v_cantidad, v_costo, v_subtotal
    );

    INSERT INTO public.movimientos_inventario (
      empresa_id, producto_id, usuario_id, tipo, cantidad, signo,
      costo_unitario, motivo, referencia_id
    ) VALUES (
      v_empresa, v_producto, v_user, 'compra', v_cantidad, 1,
      v_costo, 'Compra', v_compra
    );

    SELECT h.precio_venta INTO v_precio
    FROM public.precios_historial h
    WHERE h.producto_id = v_producto AND h.empresa_id = v_empresa
    ORDER BY h.fecha_desde DESC, h.id DESC
    LIMIT 1;
    v_precio := COALESCE(v_precio, 0);

    INSERT INTO public.precios_historial (empresa_id, producto_id, precio_venta, costo, fecha_desde)
    VALUES (v_empresa, v_producto, v_precio, v_costo, p_fecha);
  END LOOP;

  UPDATE public.compras
  SET total = v_total
  WHERE id = v_compra;

  RETURN v_compra;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.confirmar_compra(jsonb, text, date, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.ajustar_stock(
  p_producto_id uuid,
  p_tipo text,
  p_cantidad integer,
  p_motivo text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
  v_user uuid := auth.uid();
  v_signo smallint;
  v_rol text;
  v_permisos jsonb;
BEGIN
  v_empresa := public.get_empresa_id();
  v_rol := public.get_rol();
  IF v_empresa IS NULL OR v_user IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;
  IF v_rol = 'dueno' THEN
    NULL;
  ELSIF v_rol = 'operador' THEN
    SELECT u.permisos INTO v_permisos
    FROM public.usuarios u
    WHERE u.id = v_user AND u.empresa_id = v_empresa AND u.deleted_at IS NULL;
    IF COALESCE((v_permisos->>'ajustar_stock')::boolean, FALSE) IS NOT TRUE THEN
      RAISE EXCEPTION 'NO_AUTORIZADO';
    END IF;
  ELSE
    RAISE EXCEPTION 'NO_AUTORIZADO';
  END IF;
  IF p_tipo NOT IN ('ajuste_positivo', 'ajuste_negativo') THEN
    RAISE EXCEPTION 'TIPO_INVALIDO';
  END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION 'CANTIDAD_INVALIDA';
  END IF;
  IF p_motivo IS NULL OR length(trim(p_motivo)) = 0 THEN
    RAISE EXCEPTION 'MOTIVO_OBLIGATORIO';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.productos p
    WHERE p.id = p_producto_id AND p.empresa_id = v_empresa AND p.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'PRODUCTO_INVALIDO';
  END IF;

  v_signo := CASE WHEN p_tipo = 'ajuste_positivo' THEN 1 ELSE -1 END;

  INSERT INTO public.movimientos_inventario (
    empresa_id, producto_id, usuario_id, tipo, cantidad, signo, motivo
  ) VALUES (
    v_empresa, p_producto_id, v_user, p_tipo, p_cantidad, v_signo, trim(p_motivo)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.ajustar_stock(uuid, text, integer, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- CRM Clientes. En el SQL Editor usá el rol postgres, pegá TODO y dale Run.

CREATE TABLE IF NOT EXISTS public.clientes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    UUID NOT NULL REFERENCES public.empresas(id),
  nombre        TEXT NOT NULL,
  telefono      TEXT,
  email         TEXT,
  cumpleanos    DATE,
  notas_libres  TEXT,
  etiquetas     TEXT[] DEFAULT '{}',
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.clientes_interacciones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id  UUID NOT NULL REFERENCES public.clientes(id),
  empresa_id  UUID NOT NULL REFERENCES public.empresas(id),
  tipo        TEXT NOT NULL DEFAULT 'nota'
              CHECK (tipo IN ('nota','preferencia','dato_personal','queja','cumplido','seguimiento')),
  contenido   TEXT NOT NULL,
  privado     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES public.clientes(id);

CREATE INDEX IF NOT EXISTS idx_clientes_empresa ON public.clientes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_clientes_interacciones_cliente ON public.clientes_interacciones(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ventas_cliente ON public.ventas(cliente_id);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes_interacciones ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.clientes TO authenticated;
GRANT SELECT, INSERT ON public.clientes_interacciones TO authenticated;

DROP POLICY IF EXISTS "empresa_propia" ON public.clientes;
DROP POLICY IF EXISTS clientes_select ON public.clientes;
CREATE POLICY clientes_select ON public.clientes
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_empresa_id() AND deleted_at IS NULL);

DROP POLICY IF EXISTS clientes_insert ON public.clientes;
CREATE POLICY clientes_insert ON public.clientes
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.get_empresa_id()
    AND public.get_rol() IN ('dueno', 'operador')
  );

DROP POLICY IF EXISTS clientes_update ON public.clientes;
CREATE POLICY clientes_update ON public.clientes
  FOR UPDATE TO authenticated
  USING (
    empresa_id = public.get_empresa_id()
    AND public.get_rol() IN ('dueno', 'operador')
  );

DROP POLICY IF EXISTS "empresa_propia" ON public.clientes_interacciones;
DROP POLICY IF EXISTS clientes_int_select ON public.clientes_interacciones;
CREATE POLICY clientes_int_select ON public.clientes_interacciones
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.get_empresa_id()
    AND (privado IS NOT TRUE OR public.get_rol() = 'dueno')
  );

DROP POLICY IF EXISTS clientes_int_insert ON public.clientes_interacciones;
CREATE POLICY clientes_int_insert ON public.clientes_interacciones
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.get_empresa_id()
    AND public.get_rol() IN ('dueno', 'operador')
  );

CREATE OR REPLACE FUNCTION public.ventas_match_cliente(p_empresa uuid, p_cliente uuid, p_nombre text)
RETURNS TABLE (id uuid, fecha timestamptz, productos text, total numeric, forma_pago text)
LANGUAGE sql
STABLE
SET search_path TO public
AS $function$
  SELECT
    v.id,
    v.fecha,
    COALESCE(
      (
        SELECT string_agg(p.nombre || ' × ' || i.cantidad::text, ', ' ORDER BY p.nombre)
        FROM public.ventas_items i
        JOIN public.productos p ON p.id = i.producto_id
        WHERE i.venta_id = v.id
      ),
      ''
    ),
    COALESCE(
      v.total_con_interes,
      (
        SELECT SUM(i.precio_unitario * i.cantidad)
        FROM public.ventas_items i
        WHERE i.venta_id = v.id
      ) - COALESCE(v.descuento, 0)
    ),
    v.forma_pago
  FROM public.ventas v
  WHERE v.empresa_id = p_empresa
    AND v.deleted_at IS NULL
    AND (
      v.cliente_id = p_cliente
      OR (
        v.cliente_id IS NULL
        AND p_nombre IS NOT NULL
        AND lower(trim(coalesce(v.cliente_nombre, ''))) = lower(trim(p_nombre))
      )
    );
$function$;

GRANT EXECUTE ON FUNCTION public.ventas_match_cliente(uuid, uuid, text) TO authenticated;

DROP FUNCTION IF EXISTS public.listar_clientes_empresa();

CREATE OR REPLACE FUNCTION public.listar_clientes_empresa()
RETURNS TABLE (
  id uuid,
  nombre text,
  telefono text,
  ultima_compra date,
  total_gastado numeric,
  cantidad_compras bigint,
  etiquetas text[]
)
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

  RETURN QUERY
  SELECT
    c.id,
    c.nombre,
    c.telefono,
    (SELECT max(v.fecha)::date FROM public.ventas_match_cliente(v_empresa, c.id, c.nombre) v),
    COALESCE((SELECT SUM(v.total) FROM public.ventas_match_cliente(v_empresa, c.id, c.nombre) v), 0),
    COALESCE((SELECT COUNT(*) FROM public.ventas_match_cliente(v_empresa, c.id, c.nombre) v), 0),
    COALESCE(c.etiquetas, '{}'::text[])
  FROM public.clientes c
  WHERE c.empresa_id = v_empresa
    AND c.deleted_at IS NULL
  ORDER BY c.nombre;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.listar_clientes_empresa() TO authenticated;

CREATE OR REPLACE FUNCTION public.obtener_cliente_ficha(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
  v_cli public.clientes%ROWTYPE;
  v_stats jsonb;
  v_ventas jsonb;
  v_notas jsonb;
BEGIN
  v_empresa := public.get_empresa_id();
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;

  SELECT * INTO v_cli
  FROM public.clientes c
  WHERE c.id = p_id AND c.empresa_id = v_empresa AND c.deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CLIENTE_INVALIDO';
  END IF;

  SELECT jsonb_build_object(
    'total', COALESCE(SUM(v.total), 0),
    'cantidad', COUNT(*),
    'primera', MIN(v.fecha),
    'ultima', MAX(v.fecha)
  )
  INTO v_stats
  FROM public.ventas_match_cliente(v_empresa, v_cli.id, v_cli.nombre) v;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', v.id,
    'fecha', v.fecha,
    'productos', v.productos,
    'total', v.total,
    'forma_pago', v.forma_pago
  ) ORDER BY v.fecha DESC), '[]'::jsonb)
  INTO v_ventas
  FROM public.ventas_match_cliente(v_empresa, v_cli.id, v_cli.nombre) v;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', i.id,
    'tipo', i.tipo,
    'contenido', i.contenido,
    'privado', i.privado,
    'created_at', i.created_at
  ) ORDER BY i.created_at DESC), '[]'::jsonb)
  INTO v_notas
  FROM public.clientes_interacciones i
  WHERE i.cliente_id = v_cli.id
    AND i.empresa_id = v_empresa
    AND (i.privado IS NOT TRUE OR public.get_rol() = 'dueno');

  RETURN jsonb_build_object(
    'id', v_cli.id,
    'nombre', v_cli.nombre,
    'telefono', v_cli.telefono,
    'email', v_cli.email,
    'cumpleanos', v_cli.cumpleanos,
    'notas_libres', v_cli.notas_libres,
    'etiquetas', COALESCE(v_cli.etiquetas, '{}'::text[]),
    'stats', COALESCE(v_stats, '{"total":0,"cantidad":0}'::jsonb),
    'ventas', COALESCE(v_ventas, '[]'::jsonb),
    'interacciones', COALESCE(v_notas, '[]'::jsonb)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.obtener_cliente_ficha(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.crear_cliente(
  p_nombre text,
  p_telefono text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_cumpleanos date DEFAULT NULL,
  p_notas_libres text DEFAULT NULL,
  p_etiquetas text[] DEFAULT '{}'
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

  INSERT INTO public.clientes (
    empresa_id, nombre, telefono, email, cumpleanos, notas_libres, etiquetas
  ) VALUES (
    v_empresa,
    trim(p_nombre),
    nullif(trim(coalesce(p_telefono, '')), ''),
    nullif(trim(coalesce(p_email, '')), ''),
    p_cumpleanos,
    nullif(trim(coalesce(p_notas_libres, '')), ''),
    COALESCE(p_etiquetas, '{}')
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.crear_cliente(text, text, text, date, text, text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.actualizar_cliente(
  p_id uuid,
  p_nombre text,
  p_telefono text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_cumpleanos date DEFAULT NULL,
  p_notas_libres text DEFAULT NULL,
  p_etiquetas text[] DEFAULT '{}'
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

  UPDATE public.clientes
  SET
    nombre = trim(p_nombre),
    telefono = nullif(trim(coalesce(p_telefono, '')), ''),
    email = nullif(trim(coalesce(p_email, '')), ''),
    cumpleanos = p_cumpleanos,
    notas_libres = nullif(trim(coalesce(p_notas_libres, '')), ''),
    etiquetas = COALESCE(p_etiquetas, '{}')
  WHERE id = p_id
    AND empresa_id = v_empresa
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CLIENTE_INVALIDO';
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.actualizar_cliente(uuid, text, text, text, date, text, text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.agregar_interaccion_cliente(
  p_cliente_id uuid,
  p_tipo text,
  p_contenido text,
  p_privado boolean DEFAULT FALSE
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
  v_id uuid;
  v_tipo text;
BEGIN
  v_empresa := public.get_empresa_id();
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;
  IF public.get_rol() NOT IN ('dueno', 'operador') THEN
    RAISE EXCEPTION 'NO_AUTORIZADO';
  END IF;
  IF p_contenido IS NULL OR length(trim(p_contenido)) = 0 THEN
    RAISE EXCEPTION 'CONTENIDO_OBLIGATORIO';
  END IF;
  v_tipo := coalesce(nullif(trim(p_tipo), ''), 'nota');
  IF v_tipo NOT IN ('nota','preferencia','dato_personal','queja','cumplido','seguimiento') THEN
    RAISE EXCEPTION 'TIPO_INVALIDO';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id = p_cliente_id AND c.empresa_id = v_empresa AND c.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'CLIENTE_INVALIDO';
  END IF;

  INSERT INTO public.clientes_interacciones (cliente_id, empresa_id, tipo, contenido, privado)
  VALUES (p_cliente_id, v_empresa, v_tipo, trim(p_contenido), COALESCE(p_privado, FALSE))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.agregar_interaccion_cliente(uuid, text, text, boolean) TO authenticated;

DROP FUNCTION IF EXISTS public.confirmar_venta(jsonb, text, numeric, text);
DROP FUNCTION IF EXISTS public.confirmar_venta(jsonb, text, numeric, text, integer, numeric, numeric, numeric);
DROP FUNCTION IF EXISTS public.confirmar_venta(jsonb, text, numeric, text, integer, numeric, numeric, numeric, uuid);

CREATE OR REPLACE FUNCTION public.confirmar_venta(
  p_items jsonb,
  p_forma_pago text,
  p_descuento numeric,
  p_cliente text,
  p_cuotas integer DEFAULT 1,
  p_coeficiente_interes numeric DEFAULT 0,
  p_total_sin_interes numeric DEFAULT NULL,
  p_total_con_interes numeric DEFAULT NULL,
  p_cliente_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
  v_user uuid := auth.uid();
  v_venta uuid;
  v_item jsonb;
  v_producto uuid;
  v_cantidad integer;
  v_precio numeric;
  v_costo numeric;
  v_desc numeric;
  v_cuotas integer;
  v_coef numeric;
  v_nombre text;
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
  IF p_forma_pago NOT IN ('efectivo', 'transferencia', 'debito', 'credito', 'qr') THEN
    RAISE EXCEPTION 'FORMA_PAGO_INVALIDA';
  END IF;

  v_desc := COALESCE(p_descuento, 0);
  IF v_desc < 0 THEN
    RAISE EXCEPTION 'DESCUENTO_INVALIDO';
  END IF;
  v_cuotas := COALESCE(p_cuotas, 1);
  IF v_cuotas < 0 THEN
    RAISE EXCEPTION 'CUOTAS_INVALIDAS';
  END IF;
  v_coef := COALESCE(p_coeficiente_interes, 0);
  IF v_coef < 0 THEN
    RAISE EXCEPTION 'COEFICIENTE_INVALIDO';
  END IF;

  v_nombre := nullif(trim(coalesce(p_cliente, '')), '');
  IF p_cliente_id IS NOT NULL THEN
    SELECT c.nombre INTO v_nombre
    FROM public.clientes c
    WHERE c.id = p_cliente_id AND c.empresa_id = v_empresa AND c.deleted_at IS NULL;
    IF v_nombre IS NULL THEN
      RAISE EXCEPTION 'CLIENTE_INVALIDO';
    END IF;
  END IF;

  INSERT INTO public.ventas (
    empresa_id, usuario_id, forma_pago, descuento, cliente_nombre, cliente_id, canal,
    cuotas, coeficiente_interes, total_sin_interes, total_con_interes
  )
  VALUES (
    v_empresa,
    v_user,
    p_forma_pago,
    v_desc,
    v_nombre,
    p_cliente_id,
    'mostrador',
    v_cuotas,
    v_coef,
    p_total_sin_interes,
    p_total_con_interes
  )
  RETURNING id INTO v_venta;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_producto := (v_item->>'producto_id')::uuid;
    v_cantidad := (v_item->>'cantidad')::integer;
    v_precio := (v_item->>'precio_unitario')::numeric;

    IF v_producto IS NULL OR v_cantidad IS NULL OR v_cantidad <= 0 OR v_precio IS NULL OR v_precio < 0 THEN
      RAISE EXCEPTION 'ITEM_INVALIDO';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.productos p
      WHERE p.id = v_producto
        AND p.empresa_id = v_empresa
        AND p.activo = (1 = 1)
        AND p.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'PRODUCTO_INVALIDO';
    END IF;

    SELECT h.costo INTO v_costo
    FROM public.precios_historial h
    WHERE h.producto_id = v_producto AND h.empresa_id = v_empresa
    ORDER BY h.fecha_desde DESC, h.id DESC
    LIMIT 1;
    v_costo := COALESCE(v_costo, 0);

    INSERT INTO public.ventas_items (
      venta_id, empresa_id, producto_id, cantidad, precio_unitario, costo_unitario
    ) VALUES (
      v_venta, v_empresa, v_producto, v_cantidad, v_precio, v_costo
    );

    INSERT INTO public.movimientos_inventario (
      empresa_id, producto_id, usuario_id, tipo, cantidad, signo,
      costo_unitario, precio_unitario, motivo, referencia_id
    ) VALUES (
      v_empresa, v_producto, v_user, 'venta', v_cantidad, -1,
      v_costo, v_precio, 'Venta', v_venta
    );
  END LOOP;

  RETURN v_venta;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.confirmar_venta(jsonb, text, numeric, text, integer, numeric, numeric, numeric, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

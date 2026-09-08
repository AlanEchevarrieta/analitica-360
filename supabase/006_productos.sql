-- Módulo Productos + Kardex (stock por movimientos).
-- Pegá TODO el archivo en el SQL Editor y dale Run.

CREATE TABLE IF NOT EXISTS public.productos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID NOT NULL REFERENCES public.empresas(id),
  nombre      TEXT NOT NULL,
  categoria   TEXT,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_productos_empresa ON public.productos(empresa_id);

CREATE TABLE IF NOT EXISTS public.precios_historial (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    UUID NOT NULL REFERENCES public.empresas(id),
  producto_id   UUID NOT NULL REFERENCES public.productos(id),
  variante      TEXT,
  precio_venta  NUMERIC(12,2) NOT NULL CHECK (precio_venta >= 0),
  costo         NUMERIC(12,2) NOT NULL CHECK (costo >= 0),
  fecha_desde   DATE NOT NULL DEFAULT CURRENT_DATE,
  moneda_costo  TEXT DEFAULT 'ARS',
  tipo_cambio   NUMERIC(10,2)
);

CREATE INDEX IF NOT EXISTS idx_precios_empresa_producto
  ON public.precios_historial(empresa_id, producto_id, fecha_desde DESC);

CREATE TABLE IF NOT EXISTS public.movimientos_inventario (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID NOT NULL REFERENCES public.empresas(id),
  producto_id     UUID NOT NULL REFERENCES public.productos(id),
  usuario_id      UUID NOT NULL REFERENCES public.usuarios(id),
  tipo            TEXT NOT NULL,
  cantidad        INTEGER NOT NULL CHECK (cantidad > 0),
  signo           SMALLINT NOT NULL CHECK (signo IN (1, -1)),
  costo_unitario  NUMERIC(12,2),
  precio_unitario NUMERIC(12,2),
  motivo          TEXT,
  fecha           TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mov_empresa_producto
  ON public.movimientos_inventario(empresa_id, producto_id, fecha DESC);

ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.precios_historial ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_inventario ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.productos TO authenticated;
GRANT SELECT, INSERT ON public.precios_historial TO authenticated;
GRANT SELECT, INSERT ON public.movimientos_inventario TO authenticated;

DROP POLICY IF EXISTS productos_select ON public.productos;
CREATE POLICY productos_select ON public.productos
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_empresa_id() AND deleted_at IS NULL);

DROP POLICY IF EXISTS productos_insert ON public.productos;
CREATE POLICY productos_insert ON public.productos
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.get_empresa_id()
    AND public.get_rol() IN ('dueno', 'operador')
  );

DROP POLICY IF EXISTS productos_update ON public.productos;
CREATE POLICY productos_update ON public.productos
  FOR UPDATE TO authenticated
  USING (
    empresa_id = public.get_empresa_id()
    AND public.get_rol() IN ('dueno', 'operador')
  );

DROP POLICY IF EXISTS precios_select ON public.precios_historial;
CREATE POLICY precios_select ON public.precios_historial
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_empresa_id());

DROP POLICY IF EXISTS precios_insert ON public.precios_historial;
CREATE POLICY precios_insert ON public.precios_historial
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.get_empresa_id()
    AND public.get_rol() IN ('dueno', 'operador')
  );

DROP POLICY IF EXISTS movimientos_select ON public.movimientos_inventario;
CREATE POLICY movimientos_select ON public.movimientos_inventario
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_empresa_id() AND deleted_at IS NULL);

DROP POLICY IF EXISTS movimientos_insert ON public.movimientos_inventario;
CREATE POLICY movimientos_insert ON public.movimientos_inventario
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.get_empresa_id()
    AND public.get_rol() IN ('dueno', 'operador')
  );

CREATE OR REPLACE FUNCTION public.listar_productos_empresa()
RETURNS TABLE (
  id uuid,
  nombre text,
  categoria text,
  activo boolean,
  precio_venta numeric,
  costo numeric,
  stock_actual bigint
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
    p.id,
    p.nombre,
    p.categoria,
    p.activo,
    COALESCE(ph.precio_venta, 0),
    COALESCE(ph.costo, 0),
    COALESCE((
      SELECT SUM(m.cantidad * m.signo)::bigint
      FROM public.movimientos_inventario m
      WHERE m.producto_id = p.id
        AND m.empresa_id = v_empresa
        AND m.deleted_at IS NULL
    ), 0)
  FROM public.productos p
  LEFT JOIN LATERAL (
    SELECT h.precio_venta, h.costo
    FROM public.precios_historial h
    WHERE h.producto_id = p.id
      AND h.empresa_id = v_empresa
    ORDER BY h.fecha_desde DESC, h.id DESC
    LIMIT 1
  ) ph ON TRUE
  WHERE p.empresa_id = v_empresa
    AND p.deleted_at IS NULL
  ORDER BY p.nombre;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.listar_productos_empresa() TO authenticated;

CREATE OR REPLACE FUNCTION public.crear_producto(
  p_nombre text,
  p_categoria text,
  p_precio_venta numeric,
  p_costo numeric,
  p_stock_inicial integer,
  p_activo boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
  v_user uuid := auth.uid();
  v_id uuid;
  v_stock integer;
  v_costo numeric;
BEGIN
  v_empresa := public.get_empresa_id();
  IF v_empresa IS NULL OR v_user IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;
  IF public.get_rol() NOT IN ('dueno', 'operador') THEN
    RAISE EXCEPTION 'NO_AUTORIZADO';
  END IF;
  IF p_nombre IS NULL OR length(trim(p_nombre)) = 0 THEN
    RAISE EXCEPTION 'NOMBRE_OBLIGATORIO';
  END IF;
  IF p_precio_venta IS NULL OR p_precio_venta < 0 THEN
    RAISE EXCEPTION 'PRECIO_INVALIDO';
  END IF;

  v_stock := COALESCE(p_stock_inicial, 0);
  IF v_stock < 0 THEN
    RAISE EXCEPTION 'STOCK_INVALIDO';
  END IF;
  v_costo := COALESCE(p_costo, 0);
  IF v_costo < 0 THEN
    RAISE EXCEPTION 'COSTO_INVALIDO';
  END IF;

  INSERT INTO public.productos (empresa_id, nombre, categoria, activo)
  VALUES (
    v_empresa,
    trim(p_nombre),
    nullif(trim(coalesce(p_categoria, '')), ''),
    COALESCE(p_activo, TRUE)
  )
  RETURNING id INTO v_id;

  INSERT INTO public.precios_historial (empresa_id, producto_id, precio_venta, costo, fecha_desde)
  VALUES (v_empresa, v_id, p_precio_venta, v_costo, CURRENT_DATE);

  IF v_stock > 0 THEN
    INSERT INTO public.movimientos_inventario (
      empresa_id, producto_id, usuario_id, tipo, cantidad, signo, costo_unitario, motivo
    ) VALUES (
      v_empresa, v_id, v_user, 'ajuste_positivo', v_stock, 1, v_costo, 'Stock inicial'
    );
  END IF;

  RETURN v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.crear_producto(text, text, numeric, numeric, integer, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.actualizar_producto(
  p_id uuid,
  p_nombre text,
  p_categoria text,
  p_precio_venta numeric,
  p_costo numeric,
  p_activo boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
  v_costo numeric;
  v_precio_actual numeric;
  v_costo_actual numeric;
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
  IF p_precio_venta IS NULL OR p_precio_venta < 0 THEN
    RAISE EXCEPTION 'PRECIO_INVALIDO';
  END IF;
  v_costo := COALESCE(p_costo, 0);
  IF v_costo < 0 THEN
    RAISE EXCEPTION 'COSTO_INVALIDO';
  END IF;

  UPDATE public.productos
  SET
    nombre = trim(p_nombre),
    categoria = nullif(trim(coalesce(p_categoria, '')), ''),
    activo = COALESCE(p_activo, TRUE)
  WHERE id = p_id
    AND empresa_id = v_empresa
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCTO_INVALIDO';
  END IF;

  SELECT h.precio_venta, h.costo INTO v_precio_actual, v_costo_actual
  FROM public.precios_historial h
  WHERE h.producto_id = p_id AND h.empresa_id = v_empresa
  ORDER BY h.fecha_desde DESC, h.id DESC
  LIMIT 1;

  IF v_precio_actual IS DISTINCT FROM p_precio_venta
     OR v_costo_actual IS DISTINCT FROM v_costo THEN
    INSERT INTO public.precios_historial (empresa_id, producto_id, precio_venta, costo, fecha_desde)
    VALUES (v_empresa, p_id, p_precio_venta, v_costo, CURRENT_DATE);
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.actualizar_producto(uuid, text, text, numeric, numeric, boolean) TO authenticated;

-- Inventario: ubicaciones + traslados + resumen liviano.
-- SQL Editor, rol postgres. Pegá TODO y dale Run.
-- usuarios.id = auth.uid() (no existe usuarios.auth_id).

ALTER TABLE public.movimientos_inventario
  ADD COLUMN IF NOT EXISTS ubicacion_origen TEXT;

ALTER TABLE public.movimientos_inventario
  ADD COLUMN IF NOT EXISTS ubicacion_destino TEXT;

CREATE TABLE IF NOT EXISTS public.ubicaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (empresa_id, nombre)
);

ALTER TABLE public.ubicaciones ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.ubicaciones TO authenticated;

DROP POLICY IF EXISTS "empresa_propia" ON public.ubicaciones;
DROP POLICY IF EXISTS ubicaciones_empresa ON public.ubicaciones;
CREATE POLICY ubicaciones_empresa ON public.ubicaciones
  FOR ALL TO authenticated
  USING (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

INSERT INTO public.ubicaciones (empresa_id, nombre, descripcion)
SELECT e.id, 'Stand', 'Stand de feria'
FROM public.empresas e
WHERE e.nombre ILIKE '%acacia%'
  AND e.deleted_at IS NULL
ON CONFLICT (empresa_id, nombre) DO NOTHING;

INSERT INTO public.ubicaciones (empresa_id, nombre, descripcion)
SELECT e.id, 'Casa', 'Depósito en casa'
FROM public.empresas e
WHERE e.nombre ILIKE '%acacia%'
  AND e.deleted_at IS NULL
ON CONFLICT (empresa_id, nombre) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_mov_tipo_fecha
  ON public.movimientos_inventario(empresa_id, tipo, fecha DESC);

CREATE OR REPLACE FUNCTION public.registrar_traslado(
  p_producto_id uuid,
  p_cantidad integer,
  p_origen text,
  p_destino text,
  p_fecha timestamptz,
  p_notas text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
  v_user uuid := auth.uid();
  v_lote uuid := gen_random_uuid();
  v_origen text;
  v_destino text;
BEGIN
  v_empresa := public.get_empresa_id();
  IF v_empresa IS NULL OR v_user IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;
  IF public.get_rol() NOT IN ('dueno', 'operador') THEN
    RAISE EXCEPTION 'NO_AUTORIZADO';
  END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION 'CANTIDAD_INVALIDA';
  END IF;

  v_origen := nullif(trim(coalesce(p_origen, '')), '');
  v_destino := nullif(trim(coalesce(p_destino, '')), '');
  IF v_origen IS NULL OR v_destino IS NULL OR lower(v_origen) = lower(v_destino) THEN
    RAISE EXCEPTION 'UBICACION_INVALIDA';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.ubicaciones u
    WHERE u.empresa_id = v_empresa AND u.activo IS TRUE AND u.nombre = v_origen
  ) OR NOT EXISTS (
    SELECT 1 FROM public.ubicaciones u
    WHERE u.empresa_id = v_empresa AND u.activo IS TRUE AND u.nombre = v_destino
  ) THEN
    RAISE EXCEPTION 'UBICACION_INVALIDA';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.productos p
    WHERE p.id = p_producto_id AND p.empresa_id = v_empresa AND p.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'PRODUCTO_INVALIDO';
  END IF;

  INSERT INTO public.movimientos_inventario (
    empresa_id, producto_id, usuario_id, tipo, cantidad, signo, motivo, fecha,
    referencia_id, ubicacion_origen, ubicacion_destino
  ) VALUES (
    v_empresa, p_producto_id, v_user, 'transferencia', p_cantidad, -1,
    nullif(trim(coalesce(p_notas, '')), ''),
    COALESCE(p_fecha, now()),
    v_lote, v_origen, v_destino
  );

  INSERT INTO public.movimientos_inventario (
    empresa_id, producto_id, usuario_id, tipo, cantidad, signo, motivo, fecha,
    referencia_id, ubicacion_origen, ubicacion_destino
  ) VALUES (
    v_empresa, p_producto_id, v_user, 'transferencia', p_cantidad, 1,
    nullif(trim(coalesce(p_notas, '')), ''),
    COALESCE(p_fecha, now()),
    v_lote, v_origen, v_destino
  );

  RETURN v_lote;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.registrar_traslado(uuid, integer, text, text, timestamptz, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.listar_resumen_inventario()
RETURNS TABLE (
  id uuid,
  nombre text,
  categoria text,
  stock_actual bigint,
  ultima_entrada timestamptz,
  ultima_salida timestamptz,
  rotacion_30 bigint,
  stock_casa bigint,
  stock_stand bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
STABLE
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
    COALESCE((
      SELECT SUM(m.cantidad * m.signo)::bigint
      FROM public.movimientos_inventario m
      WHERE m.producto_id = p.id
        AND m.empresa_id = v_empresa
        AND m.deleted_at IS NULL
        AND m.tipo IS DISTINCT FROM 'transferencia'
    ), 0),
    (
      SELECT MAX(m.fecha)
      FROM public.movimientos_inventario m
      WHERE m.producto_id = p.id
        AND m.empresa_id = v_empresa
        AND m.deleted_at IS NULL
        AND m.tipo IN ('compra', 'ajuste_positivo', 'devolucion_cliente', 'devolucion')
    ),
    (
      SELECT MAX(m.fecha)
      FROM public.movimientos_inventario m
      WHERE m.producto_id = p.id
        AND m.empresa_id = v_empresa
        AND m.deleted_at IS NULL
        AND m.tipo IN ('venta', 'merma', 'rotura', 'perdida', 'ajuste_negativo', 'consumo_interno')
    ),
    COALESCE((
      SELECT SUM(m.cantidad)::bigint
      FROM public.movimientos_inventario m
      WHERE m.producto_id = p.id
        AND m.empresa_id = v_empresa
        AND m.deleted_at IS NULL
        AND m.tipo = 'venta'
        AND m.fecha >= (now() - interval '30 days')
    ), 0),
    COALESCE((
      SELECT SUM(
        CASE
          WHEN m.tipo = 'transferencia' AND m.ubicacion_destino = 'Casa' AND m.signo = 1 THEN m.cantidad
          WHEN m.tipo = 'transferencia' AND m.ubicacion_origen = 'Casa' AND m.signo = -1 THEN -m.cantidad
          ELSE 0
        END
      )::bigint
      FROM public.movimientos_inventario m
      WHERE m.producto_id = p.id AND m.empresa_id = v_empresa AND m.deleted_at IS NULL
    ), 0),
    COALESCE((
      SELECT SUM(
        CASE
          WHEN m.tipo = 'transferencia' AND m.ubicacion_destino = 'Stand' AND m.signo = 1 THEN m.cantidad
          WHEN m.tipo = 'transferencia' AND m.ubicacion_origen = 'Stand' AND m.signo = -1 THEN -m.cantidad
          ELSE 0
        END
      )::bigint
      FROM public.movimientos_inventario m
      WHERE m.producto_id = p.id AND m.empresa_id = v_empresa AND m.deleted_at IS NULL
    ), 0)
  FROM public.productos p
  WHERE p.empresa_id = v_empresa
    AND p.deleted_at IS NULL
  ORDER BY p.nombre;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.listar_resumen_inventario() TO authenticated;

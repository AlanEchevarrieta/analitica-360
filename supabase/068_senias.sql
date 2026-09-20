-- Señas / pagos parciales en ventas.
-- SQL Editor, rol postgres. Pegá TODO y dale Run.

ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS es_senia BOOLEAN DEFAULT FALSE;

ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS monto_senia NUMERIC(12,2) DEFAULT 0;

ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS saldo_pendiente NUMERIC(12,2) DEFAULT 0;

ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS estado_cobro TEXT DEFAULT 'pagado';

ALTER TABLE public.ventas
  DROP CONSTRAINT IF EXISTS ventas_estado_cobro_check;

ALTER TABLE public.ventas
  ADD CONSTRAINT ventas_estado_cobro_check
  CHECK (estado_cobro IN ('pagado','señado','saldo_pendiente'));

ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS fecha_cobro_saldo TIMESTAMPTZ;

UPDATE public.ventas
SET estado_cobro = 'pagado'
WHERE estado_cobro IS NULL;

CREATE OR REPLACE FUNCTION public.monto_venta(p_venta public.ventas)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path TO public
AS $$
  SELECT GREATEST(
    COALESCE(
      NULLIF(p_venta.total_con_interes, 0),
      NULLIF(p_venta.total_sin_interes, 0),
      (
        SELECT COALESCE(SUM(i.precio_unitario * i.cantidad), 0) - COALESCE(p_venta.descuento, 0)
        FROM public.ventas_items i
        WHERE i.venta_id = p_venta.id
      )
    ) - COALESCE(p_venta.saldo_pendiente, 0),
    0
  );
$$;

GRANT EXECUTE ON FUNCTION public.monto_venta(public.ventas) TO authenticated;

CREATE OR REPLACE FUNCTION public.marcar_senia_venta(p_id uuid, p_monto numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_emp uuid := public.get_empresa_id();
  v_total numeric;
BEGIN
  IF v_emp IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;
  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'SENIA_INVALIDA';
  END IF;

  SELECT COALESCE(NULLIF(total_con_interes, 0), NULLIF(total_sin_interes, 0), 0)
    INTO v_total
  FROM public.ventas
  WHERE id = p_id AND empresa_id = v_emp AND deleted_at IS NULL;

  IF v_total IS NULL THEN
    RAISE EXCEPTION 'VENTA_INVALIDA';
  END IF;
  IF p_monto >= v_total THEN
    RAISE EXCEPTION 'SENIA_INVALIDA';
  END IF;

  UPDATE public.ventas
  SET
    es_senia = TRUE,
    monto_senia = p_monto,
    saldo_pendiente = v_total - p_monto,
    estado_cobro = 'señado'
  WHERE id = p_id AND empresa_id = v_emp AND deleted_at IS NULL;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.marcar_senia_venta(uuid, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.cobrar_saldo_venta(
  p_id uuid,
  p_monto numeric,
  p_forma_pago text,
  p_fecha timestamptz DEFAULT NOW()
)
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
  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'MONTO_INVALIDO';
  END IF;
  IF p_forma_pago IS NOT NULL AND p_forma_pago NOT IN ('efectivo', 'transferencia', 'debito', 'credito', 'qr') THEN
    RAISE EXCEPTION 'FORMA_PAGO_INVALIDA';
  END IF;

  UPDATE public.ventas
  SET
    saldo_pendiente = 0,
    estado_cobro = 'pagado',
    fecha_cobro_saldo = COALESCE(p_fecha, NOW())
  WHERE id = p_id
    AND empresa_id = v_emp
    AND deleted_at IS NULL
    AND COALESCE(es_senia, FALSE) = TRUE
    AND estado_cobro IN ('señado', 'saldo_pendiente');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VENTA_INVALIDA';
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.cobrar_saldo_venta(uuid, numeric, text, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.analytics_periodo(
  p_desde date,
  p_hasta date,
  p_empresa_id uuid DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
SET statement_timeout = '15s'
AS $$
  WITH emp AS (
    SELECT COALESCE(p_empresa_id, public.get_empresa_id()) AS id
  ),
  periodo AS (
    SELECT
      v.id,
      v.fecha,
      v.forma_pago,
      GREATEST(COALESCE(v.total_con_interes, 0) - COALESCE(v.saldo_pendiente, 0), 0) AS cobrado,
      COALESCE(v.saldo_pendiente, 0) AS saldo
    FROM public.ventas v
    JOIN emp ON v.empresa_id = emp.id
    WHERE v.fecha::date BETWEEN p_desde AND p_hasta
      AND v.deleted_at IS NULL
  ),
  costos AS (
    SELECT COALESCE(SUM(
      COALESCE(vi.costo_unitario, pr.costo, 0) * vi.cantidad
    ), 0) AS costo
    FROM public.ventas_items vi
    JOIN periodo p ON p.id = vi.venta_id
    LEFT JOIN public.productos pr ON pr.id = vi.producto_id
  )
  SELECT jsonb_build_object(
    'total_ventas', COALESCE((SELECT SUM(cobrado) FROM periodo), 0),
    'cantidad', (SELECT COUNT(*) FROM periodo),
    'ticket_promedio', COALESCE((SELECT AVG(cobrado) FROM periodo), 0),
    'costo', (SELECT costo FROM costos),
    'por_cobrar', COALESCE((SELECT SUM(saldo) FROM periodo), 0),
    'ventas', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'fecha', fecha,
          'total', cobrado,
          'forma_pago', forma_pago
        )
        ORDER BY fecha
      )
      FROM periodo
    ), '[]'::jsonb)
  );
$$;

GRANT EXECUTE ON FUNCTION public.analytics_periodo(date, date, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

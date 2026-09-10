-- N° de venta correlativo, anulación de compras y ABM de categorías.
-- SQL Editor, rol postgres. Pegá TODO y dale Run.

-- 1) Número de venta por empresa (V-000001 …)
ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS numero_venta TEXT;

CREATE TABLE IF NOT EXISTS public.ventas_numeracion (
  empresa_id UUID PRIMARY KEY REFERENCES public.empresas(id),
  ultimo BIGINT NOT NULL DEFAULT 0
);

ALTER TABLE public.ventas_numeracion ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.ventas_numeracion TO authenticated;

DROP POLICY IF EXISTS ventas_numeracion_select ON public.ventas_numeracion;
CREATE POLICY ventas_numeracion_select ON public.ventas_numeracion
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_empresa_id());

CREATE OR REPLACE FUNCTION public.formato_numero_venta(p_n bigint)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 'V-' || lpad(p_n::text, GREATEST(6, length(p_n::text)), '0');
$$;

CREATE OR REPLACE FUNCTION public.asignar_numero_venta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_n bigint;
BEGIN
  IF NEW.numero_venta IS NOT NULL AND btrim(NEW.numero_venta) <> '' THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.ventas_numeracion (empresa_id, ultimo)
  VALUES (NEW.empresa_id, 1)
  ON CONFLICT (empresa_id) DO UPDATE
    SET ultimo = public.ventas_numeracion.ultimo + 1
  RETURNING ultimo INTO v_n;
  NEW.numero_venta := public.formato_numero_venta(v_n);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_asignar_numero_venta ON public.ventas;
CREATE TRIGGER trg_asignar_numero_venta
  BEFORE INSERT ON public.ventas
  FOR EACH ROW
  EXECUTE PROCEDURE public.asignar_numero_venta();

WITH ranked AS (
  SELECT
    v.id,
    v.empresa_id,
    COALESCE(mx.ultimo, 0) + row_number() OVER (PARTITION BY v.empresa_id ORDER BY v.fecha, v.id) AS n
  FROM public.ventas v
  LEFT JOIN (
    SELECT empresa_id, max(substring(numero_venta from 3)::bigint) AS ultimo
    FROM public.ventas
    WHERE numero_venta ~ '^V-[0-9]+$'
    GROUP BY empresa_id
  ) mx ON mx.empresa_id = v.empresa_id
  WHERE v.numero_venta IS NULL OR btrim(v.numero_venta) = ''
)
UPDATE public.ventas v
SET numero_venta = public.formato_numero_venta(ranked.n)
FROM ranked
WHERE v.id = ranked.id;

INSERT INTO public.ventas_numeracion (empresa_id, ultimo)
SELECT empresa_id, max(substring(numero_venta from 3)::bigint)
FROM public.ventas
WHERE numero_venta ~ '^V-[0-9]+$'
GROUP BY empresa_id
ON CONFLICT (empresa_id) DO UPDATE
  SET ultimo = GREATEST(public.ventas_numeracion.ultimo, EXCLUDED.ultimo);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ventas_empresa_numero
  ON public.ventas(empresa_id, numero_venta);

-- 2) Anulación de compras
ALTER TABLE public.anulaciones
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'venta';
ALTER TABLE public.anulaciones
  ADD COLUMN IF NOT EXISTS referencia_id UUID;

UPDATE public.anulaciones
SET referencia_id = venta_id
WHERE referencia_id IS NULL AND venta_id IS NOT NULL;

ALTER TABLE public.anulaciones
  ALTER COLUMN venta_id DROP NOT NULL;

DROP POLICY IF EXISTS compras_select ON public.compras;
CREATE POLICY compras_select ON public.compras
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_empresa_id());

GRANT UPDATE ON public.compras TO authenticated;

DROP POLICY IF EXISTS compras_update ON public.compras;
CREATE POLICY compras_update ON public.compras
  FOR UPDATE TO authenticated
  USING (
    empresa_id = public.get_empresa_id()
    AND public.get_rol() = 'dueno'
  );

ALTER TABLE public.compras_items
  ADD COLUMN IF NOT EXISTS variante_id UUID;
ALTER TABLE public.movimientos_inventario
  ADD COLUMN IF NOT EXISTS variante_id UUID;

CREATE OR REPLACE FUNCTION public.anular_compra(p_id uuid, p_motivo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
  v_user uuid := auth.uid();
  v_item record;
BEGIN
  v_empresa := public.get_empresa_id();
  IF v_empresa IS NULL OR v_user IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;
  IF public.get_rol() <> 'dueno' THEN
    RAISE EXCEPTION 'NO_AUTORIZADO';
  END IF;
  IF p_motivo IS NULL OR length(trim(p_motivo)) = 0 THEN
    RAISE EXCEPTION 'MOTIVO_OBLIGATORIO';
  END IF;

  UPDATE public.compras
  SET deleted_at = now()
  WHERE id = p_id
    AND empresa_id = v_empresa
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COMPRA_INVALIDA';
  END IF;

  FOR v_item IN
    SELECT i.producto_id, i.cantidad, i.costo_unitario, i.variante_id
    FROM public.compras_items i
    WHERE i.compra_id = p_id AND i.empresa_id = v_empresa
  LOOP
    IF v_item.producto_id IS NULL THEN
      CONTINUE;
    END IF;
    INSERT INTO public.movimientos_inventario (
      empresa_id, producto_id, usuario_id, tipo, cantidad, signo,
      costo_unitario, motivo, referencia_id, variante_id
    ) VALUES (
      v_empresa, v_item.producto_id, v_user, 'devolucion_proveedor', v_item.cantidad, -1,
      v_item.costo_unitario, trim(p_motivo), p_id, v_item.variante_id
    );
  END LOOP;

  INSERT INTO public.anulaciones (empresa_id, venta_id, usuario_id, motivo, tipo, referencia_id)
  VALUES (v_empresa, NULL, v_user, trim(p_motivo), 'compra', p_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.anular_compra(uuid, text) TO authenticated;

-- 3) Categorías
CREATE TABLE IF NOT EXISTS public.categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (empresa_id, nombre)
);

ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.categorias TO authenticated;

DROP POLICY IF EXISTS "empresa_propia" ON public.categorias;
DROP POLICY IF EXISTS categorias_empresa ON public.categorias;
CREATE POLICY categorias_empresa ON public.categorias
  FOR ALL TO authenticated
  USING (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS categoria_id UUID REFERENCES public.categorias(id);

CREATE OR REPLACE FUNCTION public.sembrar_categorias_default()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_empresa uuid;
  v_rubro text;
  v_nombres text[];
BEGIN
  v_empresa := public.get_empresa_id();
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO';
  END IF;
  IF EXISTS (SELECT 1 FROM public.categorias c WHERE c.empresa_id = v_empresa) THEN
    RETURN;
  END IF;

  SELECT lower(trim(coalesce(e.rubro, ''))) INTO v_rubro
  FROM public.empresas e
  WHERE e.id = v_empresa;

  v_nombres := CASE
    WHEN v_rubro LIKE '%indument%' OR v_rubro LIKE '%ropa%' THEN
      ARRAY['Remeras', 'Pantalones', 'Abrigos', 'Calzado', 'Accesorios']
    WHEN v_rubro LIKE '%ferreter%' THEN
      ARRAY['Herramientas', 'Tornillería', 'Pintura', 'Electricidad', 'Plomería']
    WHEN v_rubro LIKE '%gastro%' OR v_rubro LIKE '%comida%' THEN
      ARRAY['Bebidas', 'Alimentos', 'Insumos', 'Packaging']
    WHEN v_rubro LIKE '%veterin%' THEN
      ARRAY['Alimentos', 'Medicamentos', 'Accesorios', 'Higiene']
    WHEN v_rubro LIKE '%librer%' THEN
      ARRAY['Útiles', 'Papelería', 'Libros', 'Arte']
    WHEN v_rubro LIKE '%cosm%' THEN
      ARRAY['Maquillaje', 'Cuidado facial', 'Cuidado capilar', 'Fragancias']
    WHEN v_rubro LIKE '%electr%' THEN
      ARRAY['Celulares', 'Accesorios', 'Audio', 'Cables']
    WHEN v_rubro LIKE '%artesan%' THEN
      ARRAY['Decoración', 'Textil', 'Cerámica']
    WHEN v_rubro LIKE '%farmac%' THEN
      ARRAY['OTC', 'Cuidado personal', 'Primeros auxilios']
    WHEN v_rubro LIKE '%peluquer%' THEN
      ARRAY['Coloración', 'Tratamientos', 'Accesorios']
    WHEN v_rubro LIKE '%viver%' THEN
      ARRAY['Plantas', 'Macetas', 'Sustratos', 'Herramientas']
    WHEN v_rubro LIKE '%joyer%' THEN
      ARRAY['Aros', 'Collares', 'Anillos', 'Pulseras']
    ELSE
      ARRAY['General', 'Destacados', 'Ofertas']
  END;

  INSERT INTO public.categorias (empresa_id, nombre)
  SELECT v_empresa, n FROM unnest(v_nombres) AS n;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.sembrar_categorias_default() TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Limpieza de datos de PRUEBA de la empresa Acacia.
-- SQL Editor, rol postgres.
--
-- CÓMO USARLO
-- 1) Corré SOLO la PARTE A (los SELECT) y revisá las filas.
-- 2) Si está bien, corré la PARTE B (los UPDATE de deleted_at).
--
-- NO borra compras ni productos reales.
-- Las ventas del Excel histórico se protegen: no se tocan si
-- no coinciden con clientes/nombres de prueba ni cantidades irreales.
--
-- OJO: "Maria", "Cecilia", "Paulo" y "Susana" pueden ser clientes reales.
-- Si en el SELECT de clientes aparece alguien que no es prueba, no corras la PARTE B
-- hasta ajustar los filtros.

-- =============================================================================
-- PARTE A — REVISAR (correr primero)
-- =============================================================================

-- A0) Empresas Acacia (confirmá el id)
SELECT id, nombre, es_demo, created_at
FROM public.empresas
WHERE deleted_at IS NULL
  AND nombre ILIKE '%acacia%'
ORDER BY nombre;

-- A1) Clientes candidatos a prueba
SELECT
  c.id,
  e.nombre AS empresa,
  c.nombre,
  c.email,
  c.telefono,
  c.created_at
FROM public.clientes c
JOIN public.empresas e ON e.id = c.empresa_id
WHERE e.deleted_at IS NULL
  AND e.nombre ILIKE '%acacia%'
  AND e.nombre NOT ILIKE '%demo%'
  AND c.deleted_at IS NULL
  AND (
    c.nombre ILIKE '%fulanovich%'
    OR c.nombre ILIKE '%garriga%'
    OR c.nombre ILIKE '%cecilia%'
    OR c.nombre ILIKE '%paulo%'
    OR c.nombre ILIKE '%susana%'
    OR c.nombre ILIKE '%maria%'
    OR c.email ILIKE '%prueba%'
    OR c.email ILIKE '%test%'
    OR c.email ILIKE '%example.com%'
    OR c.email ILIKE '%mailinator%'
    OR c.email ILIKE '%demo%'
  )
ORDER BY c.nombre;

-- A2) Ventas ligadas a esos clientes / nombres ficticios
SELECT
  v.id,
  v.fecha,
  v.cliente_nombre,
  v.notas,
  v.forma_pago,
  (
    SELECT string_agg(p.nombre || ' x' || i.cantidad, ', ' ORDER BY p.nombre)
    FROM public.ventas_items i
    JOIN public.productos p ON p.id = i.producto_id
    WHERE i.venta_id = v.id
  ) AS items,
  (
    SELECT COALESCE(SUM(i.cantidad * i.precio_unitario), 0) - COALESCE(v.descuento, 0)
    FROM public.ventas_items i
    WHERE i.venta_id = v.id
  ) AS total
FROM public.ventas v
JOIN public.empresas e ON e.id = v.empresa_id
WHERE e.deleted_at IS NULL
  AND e.nombre ILIKE '%acacia%'
  AND e.nombre NOT ILIKE '%demo%'
  AND v.deleted_at IS NULL
  AND (
    v.cliente_nombre ILIKE '%fulanovich%'
    OR v.cliente_nombre ILIKE '%garriga%'
    OR v.cliente_nombre ILIKE '%cecilia%'
    OR v.cliente_nombre ILIKE '%paulo%'
    OR v.cliente_nombre ILIKE '%susana%'
    OR v.cliente_nombre ILIKE '%maria%'
    OR EXISTS (
      SELECT 1
      FROM public.clientes c
      WHERE c.id = v.cliente_id
        AND (
          c.nombre ILIKE '%fulanovich%'
          OR c.nombre ILIKE '%garriga%'
          OR c.nombre ILIKE '%cecilia%'
          OR c.nombre ILIKE '%paulo%'
          OR c.nombre ILIKE '%susana%'
          OR c.nombre ILIKE '%maria%'
          OR c.email ILIKE '%prueba%'
          OR c.email ILIKE '%test%'
          OR c.email ILIKE '%example.com%'
          OR c.email ILIKE '%mailinator%'
          OR c.email ILIKE '%demo%'
        )
    )
  )
ORDER BY v.fecha DESC;

-- A3) Ventas con cantidad irreal (ej. 68 Mates de Vidrio en una sola venta)
-- Umbral: 30 unidades de un mismo producto. Revisá si alguna es histórica real.
SELECT
  v.id,
  v.fecha,
  v.cliente_nombre,
  v.notas,
  p.nombre AS producto,
  i.cantidad
FROM public.ventas v
JOIN public.empresas e ON e.id = v.empresa_id
JOIN public.ventas_items i ON i.venta_id = v.id
JOIN public.productos p ON p.id = i.producto_id
WHERE e.deleted_at IS NULL
  AND e.nombre ILIKE '%acacia%'
  AND e.nombre NOT ILIKE '%demo%'
  AND v.deleted_at IS NULL
  AND i.cantidad >= 30
ORDER BY i.cantidad DESC, v.fecha DESC;

-- A4) Bombillas Pico Loro (duplicados). Se deja 1: la activa con más ventas y precio actual.
SELECT
  p.id,
  p.nombre,
  p.activo,
  p.deleted_at,
  p.created_at,
  (
    SELECT ph.precio_venta
    FROM public.precios_historial ph
    WHERE ph.producto_id = p.id
    ORDER BY ph.fecha_desde DESC, ph.id DESC
    LIMIT 1
  ) AS precio_actual,
  (
    SELECT COUNT(*)::int
    FROM public.ventas_items vi
    JOIN public.ventas v ON v.id = vi.venta_id
    WHERE vi.producto_id = p.id
      AND v.deleted_at IS NULL
  ) AS ventas_activas,
  CASE
    WHEN ROW_NUMBER() OVER (
      PARTITION BY e.id
      ORDER BY
        (p.deleted_at IS NULL) DESC,
        p.activo DESC,
        (
          SELECT COUNT(*)
          FROM public.ventas_items vi
          JOIN public.ventas v ON v.id = vi.venta_id
          WHERE vi.producto_id = p.id AND v.deleted_at IS NULL
        ) DESC,
        (
          SELECT ph.precio_venta
          FROM public.precios_historial ph
          WHERE ph.producto_id = p.id
          ORDER BY ph.fecha_desde DESC, ph.id DESC
          LIMIT 1
        ) DESC NULLS LAST,
        p.created_at ASC
    ) = 1 THEN 'CONSERVAR'
    ELSE 'BORRAR (lógico)'
  END AS decision
FROM public.productos p
JOIN public.empresas e ON e.id = p.empresa_id
WHERE e.deleted_at IS NULL
  AND e.nombre ILIKE '%acacia%'
  AND e.nombre NOT ILIKE '%demo%'
  AND p.nombre ILIKE '%pico loro%'
ORDER BY decision, p.created_at;

-- =============================================================================
-- PARTE B — APLICAR (solo después de revisar la PARTE A)
-- =============================================================================

-- B1) Ventas de prueba: clientes ficticios + cantidades irreales (>= 30)
--     Devuelve stock (mismo criterio que anular venta) y marca deleted_at.
WITH emp AS (
  SELECT id
  FROM public.empresas
  WHERE deleted_at IS NULL
    AND nombre ILIKE '%acacia%'
    AND nombre NOT ILIKE '%demo%'
),
ventas_prueba AS (
  SELECT DISTINCT v.id, v.usuario_id, v.empresa_id
  FROM public.ventas v
  JOIN emp ON emp.id = v.empresa_id
  WHERE v.deleted_at IS NULL
    AND (
      v.cliente_nombre ILIKE '%fulanovich%'
      OR v.cliente_nombre ILIKE '%garriga%'
      OR v.cliente_nombre ILIKE '%cecilia%'
      OR v.cliente_nombre ILIKE '%paulo%'
      OR v.cliente_nombre ILIKE '%susana%'
      OR v.cliente_nombre ILIKE '%maria%'
      OR EXISTS (
        SELECT 1
        FROM public.clientes c
        WHERE c.id = v.cliente_id
          AND (
            c.nombre ILIKE '%fulanovich%'
            OR c.nombre ILIKE '%garriga%'
            OR c.nombre ILIKE '%cecilia%'
            OR c.nombre ILIKE '%paulo%'
            OR c.nombre ILIKE '%susana%'
            OR c.nombre ILIKE '%maria%'
            OR c.email ILIKE '%prueba%'
            OR c.email ILIKE '%test%'
            OR c.email ILIKE '%example.com%'
            OR c.email ILIKE '%mailinator%'
            OR c.email ILIKE '%demo%'
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.ventas_items i
        WHERE i.venta_id = v.id
          AND i.cantidad >= 30
      )
    )
),
devolver_stock AS (
  INSERT INTO public.movimientos_inventario (
    empresa_id, producto_id, usuario_id, tipo, cantidad, signo,
    costo_unitario, precio_unitario, motivo, referencia_id
  )
  SELECT
    i.empresa_id,
    i.producto_id,
    vp.usuario_id,
    'devolucion_cliente',
    i.cantidad,
    1,
    i.costo_unitario,
    i.precio_unitario,
    'Limpieza datos de prueba Acacia',
    vp.id
  FROM ventas_prueba vp
  JOIN public.ventas_items i ON i.venta_id = vp.id
  RETURNING id
)
UPDATE public.ventas v
SET deleted_at = now()
FROM ventas_prueba vp
WHERE v.id = vp.id
  AND v.deleted_at IS NULL;

-- B2) Clientes de prueba
UPDATE public.clientes c
SET deleted_at = now()
FROM public.empresas e
WHERE e.id = c.empresa_id
  AND e.deleted_at IS NULL
  AND e.nombre ILIKE '%acacia%'
  AND e.nombre NOT ILIKE '%demo%'
  AND c.deleted_at IS NULL
  AND (
    c.nombre ILIKE '%fulanovich%'
    OR c.nombre ILIKE '%garriga%'
    OR c.nombre ILIKE '%cecilia%'
    OR c.nombre ILIKE '%paulo%'
    OR c.nombre ILIKE '%susana%'
    OR c.nombre ILIKE '%maria%'
    OR c.email ILIKE '%prueba%'
    OR c.email ILIKE '%test%'
    OR c.email ILIKE '%example.com%'
    OR c.email ILIKE '%mailinator%'
    OR c.email ILIKE '%demo%'
  );

-- B3) Duplicados Bombillas Pico Loro: conservar 1, el resto deleted_at
WITH emp AS (
  SELECT id
  FROM public.empresas
  WHERE deleted_at IS NULL
    AND nombre ILIKE '%acacia%'
    AND nombre NOT ILIKE '%demo%'
),
ranked AS (
  SELECT
    p.id,
    ROW_NUMBER() OVER (
      PARTITION BY p.empresa_id
      ORDER BY
        (p.deleted_at IS NULL) DESC,
        p.activo DESC,
        (
          SELECT COUNT(*)
          FROM public.ventas_items vi
          JOIN public.ventas v ON v.id = vi.venta_id
          WHERE vi.producto_id = p.id AND v.deleted_at IS NULL
        ) DESC,
        (
          SELECT ph.precio_venta
          FROM public.precios_historial ph
          WHERE ph.producto_id = p.id
          ORDER BY ph.fecha_desde DESC, ph.id DESC
          LIMIT 1
        ) DESC NULLS LAST,
        p.created_at ASC
    ) AS rn
  FROM public.productos p
  JOIN emp ON emp.id = p.empresa_id
  WHERE p.nombre ILIKE '%pico loro%'
)
UPDATE public.productos p
SET deleted_at = now(), activo = false
FROM ranked r
WHERE p.id = r.id
  AND r.rn > 1
  AND p.deleted_at IS NULL;

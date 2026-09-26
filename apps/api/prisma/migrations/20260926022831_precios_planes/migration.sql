-- Precios de lista de los planes (sin IVA), iguales a los publicados en la
-- página de Planes (apps/web/src/features/planes/planes.ts). El descuento de
-- lanzamiento (40% los primeros 3 meses) no se guarda acá.
UPDATE "planes" SET "precio_ars" = 25000 WHERE lower("nombre") IN ('basico', 'básico');
UPDATE "planes" SET "precio_ars" = 70000 WHERE lower("nombre") = 'pro';
UPDATE "planes" SET "precio_ars" = 95000 WHERE lower("nombre") IN ('premium', 'business');
UPDATE "planes" SET "precio_ars" = 0 WHERE lower("nombre") = 'starter';

-- El plan E-commerce se ofrece en la página pero no existía en la tabla.
INSERT INTO "planes" ("id", "nombre", "precio_ars", "activo", "created_at")
SELECT gen_random_uuid(), 'ecommerce', 150000, true, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "planes" WHERE lower("nombre") = 'ecommerce');

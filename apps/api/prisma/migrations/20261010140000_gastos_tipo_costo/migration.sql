-- Gastos: fijo o variable, para el punto de equilibrio. Los recurrentes que ya existían pasan a fijos.
ALTER TABLE "gastos" ADD COLUMN "tipo_costo" VARCHAR(10) NOT NULL DEFAULT 'variable';
UPDATE "gastos" SET "tipo_costo" = 'fijo' WHERE "recurrente";
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_tipo_costo_check" CHECK ("tipo_costo" IN ('fijo', 'variable'));

-- Módulo de servicios, pieza 1: servicios en el catálogo (sin stock, con duración y modo de precio).
ALTER TABLE "productos" ADD COLUMN "es_servicio" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "productos" ADD COLUMN "modo_precio" VARCHAR(15) NOT NULL DEFAULT 'fijo';
ALTER TABLE "productos" ADD COLUMN "duracion_min" INTEGER;

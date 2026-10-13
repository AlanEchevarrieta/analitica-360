-- Qué hace el negocio (productos, produccion, servicios): ordena el menú.
-- Las empresas que ya existen quedan como hasta ahora: productos + producción.
ALTER TABLE "configuracion_empresa" ADD COLUMN "actividades" TEXT[] DEFAULT ARRAY['productos', 'produccion']::TEXT[];

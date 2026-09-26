-- AlterTable
ALTER TABLE "productos" ADD COLUMN     "sku" TEXT;

-- SKU único por empresa en cada tabla (el cruce producto/variante lo valida la API).
CREATE UNIQUE INDEX "productos_empresa_sku_key" ON "productos"("empresa_id", upper("sku")) WHERE "sku" IS NOT NULL AND "deleted_at" IS NULL;
CREATE UNIQUE INDEX "producto_variantes_empresa_sku_key" ON "producto_variantes"("empresa_id", upper("sku")) WHERE "sku" IS NOT NULL AND "deleted_at" IS NULL;

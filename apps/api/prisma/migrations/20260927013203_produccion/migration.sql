-- AlterTable
ALTER TABLE "configuracion_empresa" ADD COLUMN     "valor_hora" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "productos" ADD COLUMN     "es_insumo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "unidad" TEXT NOT NULL DEFAULT 'unidad';

-- CreateTable
CREATE TABLE "recetas" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "variante_id" UUID,
    "minutos" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "armar_al_vender" BOOLEAN NOT NULL DEFAULT false,
    "notas" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recetas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recetas_items" (
    "id" UUID NOT NULL,
    "receta_id" UUID NOT NULL,
    "insumo_id" UUID NOT NULL,
    "insumo_variante_id" UUID,
    "cantidad" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "recetas_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordenes_produccion" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "receta_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "variante_id" UUID,
    "cantidad" DECIMAL(12,2) NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'terminada',
    "costo_materiales" DECIMAL(14,2) NOT NULL,
    "costo_mano_obra" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "ubicacion" TEXT,
    "notas" TEXT,
    "usuario_id" UUID NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "anulada_at" TIMESTAMP(3),

    CONSTRAINT "ordenes_produccion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recetas_empresa_id_idx" ON "recetas"("empresa_id");

-- CreateIndex
CREATE INDEX "recetas_items_receta_id_idx" ON "recetas_items"("receta_id");

-- CreateIndex
CREATE INDEX "ordenes_produccion_empresa_id_fecha_idx" ON "ordenes_produccion"("empresa_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_produccion_empresa_id_numero_key" ON "ordenes_produccion"("empresa_id", "numero");

-- AddForeignKey
ALTER TABLE "recetas" ADD CONSTRAINT "recetas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recetas" ADD CONSTRAINT "recetas_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recetas_items" ADD CONSTRAINT "recetas_items_receta_id_fkey" FOREIGN KEY ("receta_id") REFERENCES "recetas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recetas_items" ADD CONSTRAINT "recetas_items_insumo_id_fkey" FOREIGN KEY ("insumo_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_produccion" ADD CONSTRAINT "ordenes_produccion_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_produccion" ADD CONSTRAINT "ordenes_produccion_receta_id_fkey" FOREIGN KEY ("receta_id") REFERENCES "recetas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_produccion" ADD CONSTRAINT "ordenes_produccion_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Una receta vigente por producto/variante.
CREATE UNIQUE INDEX "recetas_producto_variante_key" ON "recetas" ("empresa_id", "producto_id", COALESCE("variante_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE "deleted_at" IS NULL;

-- AlterTable
ALTER TABLE "clientes" ADD COLUMN     "lista_precio_id" UUID;

-- AlterTable
ALTER TABLE "ventas" ADD COLUMN     "lista_precio_id" UUID;

-- CreateTable
CREATE TABLE "listas_precios" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "ajuste_pct" DECIMAL(6,2) NOT NULL,
    "redondeo" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listas_precios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "listas_precios_empresa_id_idx" ON "listas_precios"("empresa_id");

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_lista_precio_id_fkey" FOREIGN KEY ("lista_precio_id") REFERENCES "listas_precios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_lista_precio_id_fkey" FOREIGN KEY ("lista_precio_id") REFERENCES "listas_precios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listas_precios" ADD CONSTRAINT "listas_precios_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Nombre único por empresa entre las listas vigentes.
CREATE UNIQUE INDEX "listas_precios_empresa_nombre_key" ON "listas_precios" ("empresa_id", lower("nombre")) WHERE "deleted_at" IS NULL;

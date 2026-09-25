-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN     "venta_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_venta_id_key" ON "pedidos"("venta_id");

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE SET NULL ON UPDATE CASCADE;


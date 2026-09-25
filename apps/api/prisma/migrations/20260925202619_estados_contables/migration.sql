-- AlterTable
ALTER TABLE "compras" ADD COLUMN     "a_credito" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "movimientos_financieros" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "usuario_id" UUID,
    "tipo" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "fecha" DATE NOT NULL,
    "descripcion" TEXT NOT NULL,
    "proveedor_id" UUID,
    "vida_util_meses" INTEGER,
    "con_caja" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_financieros_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "movimientos_financieros_empresa_id_fecha_idx" ON "movimientos_financieros"("empresa_id", "fecha");

-- AddForeignKey
ALTER TABLE "movimientos_financieros" ADD CONSTRAINT "movimientos_financieros_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_financieros" ADD CONSTRAINT "movimientos_financieros_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_financieros" ADD CONSTRAINT "movimientos_financieros_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

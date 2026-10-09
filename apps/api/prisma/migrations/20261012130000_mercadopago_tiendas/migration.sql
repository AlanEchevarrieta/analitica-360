-- Mercado Pago en las tiendas: cuenta de cada comercio (OAuth) y estado del pago de cada pedido.
-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN     "pagado_en" TIMESTAMP(3),
ADD COLUMN     "pago_estado" VARCHAR(30),
ADD COLUMN     "pago_id" TEXT;

-- CreateTable
CREATE TABLE "mp_cuentas_tienda" (
    "empresa_id" UUID NOT NULL,
    "mp_user_id" TEXT NOT NULL,
    "credenciales" TEXT NOT NULL,
    "public_key" TEXT,
    "vence_en" TIMESTAMP(3) NOT NULL,
    "aviso_clave" TEXT NOT NULL,
    "conectado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mp_cuentas_tienda_pkey" PRIMARY KEY ("empresa_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mp_cuentas_tienda_aviso_clave_key" ON "mp_cuentas_tienda"("aviso_clave");

-- AddForeignKey
ALTER TABLE "mp_cuentas_tienda" ADD CONSTRAINT "mp_cuentas_tienda_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Un pago de Mercado Pago corresponde a un solo pedido.
CREATE UNIQUE INDEX "pedidos_pago_id_key" ON "pedidos"("empresa_id", "pago_id") WHERE "pago_id" IS NOT NULL;

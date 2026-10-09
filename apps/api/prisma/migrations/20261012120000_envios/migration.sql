-- Envíos con un agregador (Zipnova): conexión por empresa y el envío de cada pedido.
-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN     "costo_envio" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "envio_estado" TEXT,
ADD COLUMN     "envio_id" TEXT,
ADD COLUMN     "envio_opcion" JSONB;

-- CreateTable
CREATE TABLE "envios_config" (
    "empresa_id" UUID NOT NULL,
    "proveedor" TEXT NOT NULL DEFAULT 'zipnova',
    "cuenta_id" INTEGER NOT NULL,
    "origen_id" INTEGER,
    "credenciales" TEXT NOT NULL,
    "aviso_clave" TEXT NOT NULL,
    "en_tienda" BOOLEAN NOT NULL DEFAULT true,
    "gratis_desde" DECIMAL(12,2),
    "peso_defecto_gr" INTEGER NOT NULL DEFAULT 1000,
    "verificado_en" TIMESTAMP(3),
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "envios_config_pkey" PRIMARY KEY ("empresa_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "envios_config_aviso_clave_key" ON "envios_config"("aviso_clave");

-- AddForeignKey
ALTER TABLE "envios_config" ADD CONSTRAINT "envios_config_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Un envío del proveedor pertenece a un solo pedido.
CREATE UNIQUE INDEX "pedidos_envio_id_key" ON "pedidos"("empresa_id", "envio_id") WHERE "envio_id" IS NOT NULL;

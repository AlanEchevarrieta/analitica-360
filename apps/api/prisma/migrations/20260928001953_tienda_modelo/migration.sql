-- AlterTable
ALTER TABLE "productos" ADD COLUMN     "en_tienda" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "tiendas_config" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT false,
    "subdominio" TEXT NOT NULL,
    "dominio_propio" TEXT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "logo_url" TEXT,
    "whatsapp" TEXT,
    "instagram" TEXT,
    "texto_envios" TEXT,
    "alias" TEXT,
    "cbu" TEXT,
    "titular" TEXT,
    "mostrar_sin_stock" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tiendas_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos_imagenes" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "productos_imagenes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tiendas_config_empresa_id_key" ON "tiendas_config"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "tiendas_config_subdominio_key" ON "tiendas_config"("subdominio");

-- CreateIndex
CREATE UNIQUE INDEX "tiendas_config_dominio_propio_key" ON "tiendas_config"("dominio_propio");

-- CreateIndex
CREATE INDEX "productos_imagenes_producto_id_orden_idx" ON "productos_imagenes"("producto_id", "orden");

-- AddForeignKey
ALTER TABLE "tiendas_config" ADD CONSTRAINT "tiendas_config_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos_imagenes" ADD CONSTRAINT "productos_imagenes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos_imagenes" ADD CONSTRAINT "productos_imagenes_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

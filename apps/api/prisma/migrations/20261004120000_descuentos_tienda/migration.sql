-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN     "cupon_codigo" VARCHAR(40),
ADD COLUMN     "descuento_cupon" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "descuento_ofertas" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "descuento_transferencia" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "forma_pago_tienda" VARCHAR(20);

-- AlterTable
ALTER TABLE "productos" ADD COLUMN     "oferta_desde" DATE,
ADD COLUMN     "oferta_hasta" DATE,
ADD COLUMN     "oferta_tipo" VARCHAR(10),
ADD COLUMN     "oferta_valor" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "tiendas_config" ADD COLUMN     "descuento_transferencia" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "cupones_tienda" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "codigo" VARCHAR(40) NOT NULL,
    "tipo" VARCHAR(10) NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "compra_minima" DECIMAL(12,2),
    "desde" DATE,
    "hasta" DATE,
    "usos_max" INTEGER,
    "usos" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cupones_tienda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cupones_tienda_empresa_id_codigo_key" ON "cupones_tienda"("empresa_id", "codigo");

-- AddForeignKey
ALTER TABLE "cupones_tienda" ADD CONSTRAINT "cupones_tienda_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Reglas que la base hace cumplir aunque falle la validación de la app.
ALTER TABLE "productos" ADD CONSTRAINT "productos_oferta_valida" CHECK (
  oferta_tipo IS NULL OR (oferta_tipo IN ('porcentaje', 'precio') AND oferta_valor > 0 AND (oferta_tipo <> 'porcentaje' OR oferta_valor < 100)));
ALTER TABLE "cupones_tienda" ADD CONSTRAINT "cupones_tienda_valido" CHECK (
  tipo IN ('porcentaje', 'monto') AND valor > 0 AND (tipo <> 'porcentaje' OR valor < 100) AND usos >= 0 AND (usos_max IS NULL OR usos <= usos_max));
ALTER TABLE "tiendas_config" ADD CONSTRAINT "tiendas_config_transferencia_valida" CHECK (descuento_transferencia >= 0 AND descuento_transferencia < 100);

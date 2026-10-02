-- AlterTable
ALTER TABLE "empresas" ADD COLUMN     "camara_id" UUID,
ADD COLUMN     "comision_hasta" DATE,
ADD COLUMN     "comision_pct" DECIMAL(5,2),
ADD COLUMN     "cuit" TEXT,
ADD COLUMN     "cupon_id" UUID,
ADD COLUMN     "orden_camara" INTEGER,
ADD COLUMN     "primer_pago_en" DATE,
ADD COLUMN     "prueba_desde" DATE,
ADD COLUMN     "prueba_hasta" DATE;

-- AlterTable
ALTER TABLE "pagos" ADD COLUMN     "ciclo" TEXT,
ADD COLUMN     "cuota" INTEGER,
ADD COLUMN     "cuotas" INTEGER,
ADD COLUMN     "cupon_id" UUID,
ADD COLUMN     "descuento_ars" DECIMAL(12,2),
ADD COLUMN     "devolucion_motivo" TEXT,
ADD COLUMN     "devuelto_en" TIMESTAMP(3),
ADD COLUMN     "grupo_id" UUID,
ADD COLUMN     "origen" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN     "periodo_desde" DATE,
ADD COLUMN     "periodo_hasta" DATE,
ADD COLUMN     "plan" TEXT,
ADD COLUMN     "precio_lista" DECIMAL(12,2),
ADD COLUMN     "referencia_externa" TEXT,
ADD COLUMN     "regla_aplicada" TEXT,
ADD COLUMN     "tipo_periodo" TEXT;

-- CreateTable
CREATE TABLE "camaras" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "contacto_nombre" TEXT,
    "contacto_email" TEXT,
    "contacto_telefono" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "meses_comision" INTEGER NOT NULL DEFAULT 24,
    "tramos" JSONB NOT NULL,
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "camaras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cupones" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "camara_id" UUID,
    "empresa_referente_id" UUID,
    "descripcion" TEXT,
    "dias_prueba" INTEGER,
    "reglas" JSONB NOT NULL DEFAULT '{}',
    "desde" DATE,
    "hasta" DATE,
    "max_usos" INTEGER,
    "usos" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cupones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cupones_usos" (
    "id" UUID NOT NULL,
    "cupon_id" UUID NOT NULL,
    "empresa_id" UUID,
    "clerk_user_id" TEXT,
    "email" TEXT,
    "cuit" TEXT,
    "con_prueba" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cupones_usos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comisiones" (
    "id" UUID NOT NULL,
    "camara_id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "pago_id" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "base" DECIMAL(12,2) NOT NULL,
    "proporcion" DECIMAL(9,6) NOT NULL,
    "porcentaje" DECIMAL(5,2) NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "periodo_desde" DATE,
    "periodo_hasta" DATE,
    "mes" DATE NOT NULL,
    "liquidacion_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comisiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidaciones" (
    "id" UUID NOT NULL,
    "camara_id" UUID NOT NULL,
    "mes" DATE NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "aprobada_en" TIMESTAMP(3),
    "aprobada_por" TEXT,
    "pagada_en" DATE,
    "referencia" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "liquidaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cambios_origen" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "camara_anterior_id" UUID,
    "camara_nueva_id" UUID,
    "cupon_anterior_id" UUID,
    "cupon_nuevo_id" UUID,
    "motivo" TEXT NOT NULL,
    "hecho_por" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cambios_origen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cupones_codigo_key" ON "cupones"("codigo");

-- CreateIndex
CREATE INDEX "cupones_camara_id_idx" ON "cupones"("camara_id");

-- CreateIndex
CREATE INDEX "cupones_usos_email_idx" ON "cupones_usos"("email");

-- CreateIndex
CREATE INDEX "cupones_usos_clerk_user_id_idx" ON "cupones_usos"("clerk_user_id");

-- CreateIndex
CREATE INDEX "cupones_usos_cuit_idx" ON "cupones_usos"("cuit");

-- CreateIndex
CREATE INDEX "cupones_usos_empresa_id_idx" ON "cupones_usos"("empresa_id");

-- CreateIndex
CREATE INDEX "comisiones_camara_id_mes_idx" ON "comisiones"("camara_id", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "comisiones_pago_id_tipo_key" ON "comisiones"("pago_id", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "liquidaciones_camara_id_mes_key" ON "liquidaciones"("camara_id", "mes");

-- CreateIndex
CREATE INDEX "cambios_origen_empresa_id_idx" ON "cambios_origen"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "empresas_camara_id_orden_camara_key" ON "empresas"("camara_id", "orden_camara");

-- AddForeignKey
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_camara_id_fkey" FOREIGN KEY ("camara_id") REFERENCES "camaras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_cupon_id_fkey" FOREIGN KEY ("cupon_id") REFERENCES "cupones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_cupon_id_fkey" FOREIGN KEY ("cupon_id") REFERENCES "cupones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cupones" ADD CONSTRAINT "cupones_camara_id_fkey" FOREIGN KEY ("camara_id") REFERENCES "camaras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cupones" ADD CONSTRAINT "cupones_empresa_referente_id_fkey" FOREIGN KEY ("empresa_referente_id") REFERENCES "empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cupones_usos" ADD CONSTRAINT "cupones_usos_cupon_id_fkey" FOREIGN KEY ("cupon_id") REFERENCES "cupones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comisiones" ADD CONSTRAINT "comisiones_camara_id_fkey" FOREIGN KEY ("camara_id") REFERENCES "camaras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comisiones" ADD CONSTRAINT "comisiones_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comisiones" ADD CONSTRAINT "comisiones_pago_id_fkey" FOREIGN KEY ("pago_id") REFERENCES "pagos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comisiones" ADD CONSTRAINT "comisiones_liquidacion_id_fkey" FOREIGN KEY ("liquidacion_id") REFERENCES "liquidaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidaciones" ADD CONSTRAINT "liquidaciones_camara_id_fkey" FOREIGN KEY ("camara_id") REFERENCES "camaras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cambios_origen" ADD CONSTRAINT "cambios_origen_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ==== Datos: precios de lista (2026-10-02) y Pro absorbe a Premium ====
UPDATE "planes" SET "precio_ars" = 49000 WHERE "nombre" = 'basico';
UPDATE "planes" SET "precio_ars" = 89000 WHERE "nombre" = 'pro';
UPDATE "planes" SET "precio_ars" = 149000 WHERE "nombre" = 'ecommerce';
UPDATE "suscripciones"
  SET "plan_id" = (SELECT "id" FROM "planes" WHERE "nombre" = 'pro' ORDER BY "created_at" LIMIT 1)
  WHERE "plan_id" IN (SELECT "id" FROM "planes" WHERE "nombre" IN ('premium', 'business'))
    AND EXISTS (SELECT 1 FROM "planes" WHERE "nombre" = 'pro');
UPDATE "empresas" SET "plan_actual" = 'pro' WHERE lower("plan_actual") IN ('premium', 'business');
UPDATE "planes" SET "activo" = false WHERE "nombre" IN ('premium', 'business');

-- ==== Datos: UCIM y su código UCIM360 ====
INSERT INTO "camaras" ("id", "nombre", "activa", "meses_comision", "tramos", "updated_at")
VALUES (
  gen_random_uuid(), 'UCIM', true, 24,
  '[{"desde":1,"hasta":50,"porcentaje":20},{"desde":51,"hasta":75,"porcentaje":25},{"desde":76,"hasta":100,"porcentaje":30},{"desde":101,"hasta":150,"porcentaje":35},{"desde":151,"hasta":null,"porcentaje":40}]',
  now()
);
INSERT INTO "cupones" ("id", "codigo", "tipo", "camara_id", "descripcion", "dias_prueba", "reglas", "activo", "updated_at")
SELECT
  gen_random_uuid(), 'UCIM360', 'camara', "id", 'Socios de la UCIM: 1 mes gratis, 40% el primer trimestre (3 cuotas), anual 25% el primer año y 20% en cada renovación', 30,
  '{"mensual":{"entrada":[],"periodosEntrada":1,"renovacionPct":0,"renovacionPeriodos":null,"cuotas":1},"trimestral":{"entrada":[{"meses":3,"porcentaje":40}],"periodosEntrada":1,"renovacionPct":0,"renovacionPeriodos":null,"cuotas":3},"anual":{"entrada":[{"meses":3,"porcentaje":40},{"meses":9,"porcentaje":20}],"periodosEntrada":1,"renovacionPct":20,"renovacionPeriodos":null,"cuotas":1}}',
  true, now()
FROM "camaras" WHERE "nombre" = 'UCIM';

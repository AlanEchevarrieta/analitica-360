-- AlterTable
ALTER TABLE "planes" ADD COLUMN     "cuotas_anual" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "cuotas_trimestral" INTEGER NOT NULL DEFAULT 3;

-- CreateTable
CREATE TABLE "cuotas_programadas" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "grupo_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "cuotas" INTEGER NOT NULL,
    "plan" TEXT NOT NULL,
    "ciclo" TEXT NOT NULL,
    "tipo_periodo" TEXT NOT NULL,
    "cupon_id" UUID,
    "monto" DECIMAL(12,2) NOT NULL,
    "precio_lista" DECIMAL(12,2) NOT NULL,
    "periodo_desde" DATE NOT NULL,
    "periodo_hasta" DATE NOT NULL,
    "vence" DATE NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "pago_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuotas_programadas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cuotas_programadas_pago_id_key" ON "cuotas_programadas"("pago_id");

-- CreateIndex
CREATE INDEX "cuotas_programadas_empresa_id_idx" ON "cuotas_programadas"("empresa_id");

-- CreateIndex
CREATE INDEX "cuotas_programadas_estado_vence_idx" ON "cuotas_programadas"("estado", "vence");

-- CreateIndex
CREATE UNIQUE INDEX "cuotas_programadas_grupo_id_numero_key" ON "cuotas_programadas"("grupo_id", "numero");

-- AddForeignKey
ALTER TABLE "cuotas_programadas" ADD CONSTRAINT "cuotas_programadas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuotas_programadas" ADD CONSTRAINT "cuotas_programadas_pago_id_fkey" FOREIGN KEY ("pago_id") REFERENCES "pagos"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ==== Datos: UCIM360 también paga el anual en 3 cuotas (primer año y renovaciones) ====
UPDATE "cupones" SET "reglas" = jsonb_set("reglas"::jsonb, '{anual,cuotas}', '3'::jsonb) WHERE "codigo" = 'UCIM360' AND "reglas" ? 'anual';

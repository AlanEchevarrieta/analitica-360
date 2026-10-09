-- Débito automático con Mercado Pago: una suscripción por empresa, y nunca dos pagos con la misma referencia de Mercado Pago.
-- CreateTable
CREATE TABLE "mp_suscripciones" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "preapproval_id" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "ciclo" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "url_autorizar" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mp_suscripciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mp_suscripciones_empresa_id_key" ON "mp_suscripciones"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "mp_suscripciones_preapproval_id_key" ON "mp_suscripciones"("preapproval_id");

-- AddForeignKey
ALTER TABLE "mp_suscripciones" ADD CONSTRAINT "mp_suscripciones_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "pagos_mercadopago_referencia_key" ON "pagos"("referencia_externa") WHERE "origen" = 'mercadopago';

-- Referidos: premio para quien recomienda cuando el recomendado hace su primer pago.
CREATE TABLE "premios_referidos" (
    "id" UUID NOT NULL,
    "empresa_referente_id" UUID NOT NULL,
    "empresa_referida_id" UUID NOT NULL,
    "pago_origen_id" UUID NOT NULL,
    "porcentaje" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "estado" VARCHAR(12) NOT NULL DEFAULT 'disponible',
    "pago_uso_id" UUID,
    "usado_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "premios_referidos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "premios_referidos_empresa_referida_id_key" ON "premios_referidos"("empresa_referida_id");
CREATE INDEX "premios_referidos_empresa_referente_id_estado_idx" ON "premios_referidos"("empresa_referente_id", "estado");

ALTER TABLE "premios_referidos" ADD CONSTRAINT "premios_referidos_empresa_referente_id_fkey" FOREIGN KEY ("empresa_referente_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "premios_referidos" ADD CONSTRAINT "premios_referidos_empresa_referida_id_fkey" FOREIGN KEY ("empresa_referida_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

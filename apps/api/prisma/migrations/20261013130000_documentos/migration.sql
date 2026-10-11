-- Documentos: número de recibo en los cobros y configuración (logo, pie, validez del presupuesto).
ALTER TABLE "cobros_clientes" ADD COLUMN "numero_recibo" INTEGER;
CREATE UNIQUE INDEX "cobros_clientes_empresa_id_numero_recibo_key" ON "cobros_clientes"("empresa_id", "numero_recibo");

CREATE TABLE "documentos_config" (
    "empresa_id" UUID NOT NULL,
    "logo_url" TEXT,
    "pie" VARCHAR(300),
    "validez_presupuesto_dias" INTEGER NOT NULL DEFAULT 15,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "documentos_config_pkey" PRIMARY KEY ("empresa_id")
);

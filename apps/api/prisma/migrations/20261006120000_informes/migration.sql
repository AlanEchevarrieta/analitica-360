-- Informes automáticos por email (semanal y mensual)
CREATE TABLE "informes_config" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "semanal" BOOLEAN NOT NULL DEFAULT true,
    "mensual" BOOLEAN NOT NULL DEFAULT true,
    "emails_extra" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bajas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "informes_config_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "informes_enviados" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "tipo" VARCHAR(10) NOT NULL,
    "desde" DATE NOT NULL,
    "hasta" DATE NOT NULL,
    "estado" VARCHAR(20) NOT NULL,
    "destinatarios" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "error" VARCHAR(300),
    "intentos" INTEGER NOT NULL DEFAULT 1,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviado_en" TIMESTAMP(3),

    CONSTRAINT "informes_enviados_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "informes_config_empresa_id_key" ON "informes_config"("empresa_id");
CREATE UNIQUE INDEX "informes_enviados_empresa_id_tipo_desde_key" ON "informes_enviados"("empresa_id", "tipo", "desde");
CREATE INDEX "informes_enviados_creado_en_idx" ON "informes_enviados"("creado_en");

ALTER TABLE "informes_config" ADD CONSTRAINT "informes_config_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "informes_enviados" ADD CONSTRAINT "informes_enviados_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

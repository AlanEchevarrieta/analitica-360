-- Módulo de servicios, pieza 5: comisiones por profesional; y reservas online "sin ver".
ALTER TABLE "ventas" ADD COLUMN "profesional_id" UUID;
CREATE INDEX "ventas_empresa_id_profesional_id_idx" ON "ventas"("empresa_id", "profesional_id");

ALTER TABLE "agenda_recursos" ADD COLUMN "comision_servicios" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN "comision_productos" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN "comision_sesion" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "turnos" ADD COLUMN "visto_en" TIMESTAMP(3);
-- Lo que ya existe se da por visto.
UPDATE "turnos" SET "visto_en" = CURRENT_TIMESTAMP;

CREATE TABLE "comision_pagos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "empresa_id" UUID NOT NULL,
    "recurso_id" UUID NOT NULL,
    "desde" DATE NOT NULL,
    "hasta" DATE NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "gasto_id" UUID,
    "nota" VARCHAR(200),
    "usuario_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "comision_pagos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "comision_pagos_empresa_id_recurso_id_idx" ON "comision_pagos"("empresa_id", "recurso_id");

-- Precios de lista con fecha de vigencia (aumentos por IPC con aviso de 30 días).
CREATE TABLE "precios_plan" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "plan" VARCHAR(20) NOT NULL,
    "precio_mensual" DECIMAL(12,2) NOT NULL,
    "vigente_desde" DATE NOT NULL,
    "motivo" VARCHAR(200),
    "aviso_enviado_en" TIMESTAMP(3),
    "avisados" INTEGER NOT NULL DEFAULT 0,
    "creado_por" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "precios_plan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "precios_plan_plan_vigente_desde_key" ON "precios_plan"("plan", "vigente_desde");

-- Punto de partida: los precios de la estrategia del 2026-10-05, ya vigentes (sin aviso que mandar).
INSERT INTO "precios_plan" ("plan", "precio_mensual", "vigente_desde", "motivo", "aviso_enviado_en")
VALUES
    ('basico', 49000, '2026-10-01', 'Precios iniciales', '2026-09-01'),
    ('pro', 89000, '2026-10-01', 'Precios iniciales', '2026-09-01'),
    ('ecommerce', 149000, '2026-10-01', 'Precios iniciales', '2026-09-01');

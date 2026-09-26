-- AlterTable
ALTER TABLE "configuracion_empresa" ADD COLUMN     "categoria_monotributo" TEXT,
ADD COLUMN     "condicion_fiscal" TEXT NOT NULL DEFAULT 'monotributo';

-- CreateTable
CREATE TABLE "monotributo_topes" (
    "id" UUID NOT NULL,
    "vigencia_desde" DATE NOT NULL,
    "categoria" TEXT NOT NULL,
    "tope_anual" DECIMAL(16,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monotributo_topes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "monotributo_topes_vigencia_desde_categoria_key" ON "monotributo_topes"("vigencia_desde", "categoria");

-- Punto de partida: topes vigentes desde febrero de 2025 (ingresos brutos
-- anuales). Hay que cargar los actualizados desde la consola de Admin.
INSERT INTO "monotributo_topes" ("id", "vigencia_desde", "categoria", "tope_anual") VALUES
  (gen_random_uuid(), '2025-02-01', 'A', 7813063.45),
  (gen_random_uuid(), '2025-02-01', 'B', 11447046.44),
  (gen_random_uuid(), '2025-02-01', 'C', 16050091.57),
  (gen_random_uuid(), '2025-02-01', 'D', 19926340.10),
  (gen_random_uuid(), '2025-02-01', 'E', 23439190.34),
  (gen_random_uuid(), '2025-02-01', 'F', 29374695.90),
  (gen_random_uuid(), '2025-02-01', 'G', 35128502.31),
  (gen_random_uuid(), '2025-02-01', 'H', 53298417.30),
  (gen_random_uuid(), '2025-02-01', 'I', 59657887.55),
  (gen_random_uuid(), '2025-02-01', 'J', 68318880.36),
  (gen_random_uuid(), '2025-02-01', 'K', 82370281.28)
ON CONFLICT DO NOTHING;

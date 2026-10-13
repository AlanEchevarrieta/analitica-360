-- Módulo de servicios, pieza 3, parte 2: reserva online de turnos desde la tienda.
CREATE TABLE "agenda_config" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "empresa_id" UUID NOT NULL,
    "reserva_online" BOOLEAN NOT NULL DEFAULT false,
    "anticipacion_min" INTEGER NOT NULL DEFAULT 120,
    "dias_maximo" INTEGER NOT NULL DEFAULT 30,
    "mensaje" VARCHAR(300),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agenda_config_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "agenda_config_empresa_id_key" ON "agenda_config"("empresa_id");

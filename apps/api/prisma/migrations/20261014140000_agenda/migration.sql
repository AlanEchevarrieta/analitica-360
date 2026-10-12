-- Módulo de servicios, pieza 3: agenda (recursos, horarios, días cerrados y turnos).
CREATE TABLE "agenda_recursos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "empresa_id" UUID NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "usuario_id" UUID,
    "color" VARCHAR(7) NOT NULL DEFAULT '#6366f1',
    "online" BOOLEAN NOT NULL DEFAULT true,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "agenda_recursos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "agenda_recursos_empresa_id_idx" ON "agenda_recursos"("empresa_id");

CREATE TABLE "agenda_horarios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recurso_id" UUID NOT NULL,
    "dia_semana" INTEGER NOT NULL,
    "desde" VARCHAR(5) NOT NULL,
    "hasta" VARCHAR(5) NOT NULL,
    CONSTRAINT "agenda_horarios_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "agenda_horarios_recurso_id_idx" ON "agenda_horarios"("recurso_id");
ALTER TABLE "agenda_horarios" ADD CONSTRAINT "agenda_horarios_recurso_id_fkey" FOREIGN KEY ("recurso_id") REFERENCES "agenda_recursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "agenda_bloqueos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "empresa_id" UUID NOT NULL,
    "recurso_id" UUID,
    "fecha" DATE NOT NULL,
    "motivo" VARCHAR(120),
    CONSTRAINT "agenda_bloqueos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "agenda_bloqueos_empresa_id_fecha_idx" ON "agenda_bloqueos"("empresa_id", "fecha");

CREATE TABLE "turnos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "empresa_id" UUID NOT NULL,
    "recurso_id" UUID NOT NULL,
    "servicio_id" UUID,
    "cliente_id" UUID,
    "cliente_nombre" TEXT,
    "cliente_telefono" VARCHAR(40),
    "inicio" TIMESTAMPTZ(3) NOT NULL,
    "fin" TIMESTAMPTZ(3) NOT NULL,
    "estado" VARCHAR(15) NOT NULL DEFAULT 'reservado',
    "notas" VARCHAR(1000),
    "origen" VARCHAR(10) NOT NULL DEFAULT 'interno',
    "venta_id" UUID,
    "recordado_en" TIMESTAMP(3),
    "usuario_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "turnos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "turnos_venta_id_key" ON "turnos"("venta_id");
CREATE INDEX "turnos_empresa_id_inicio_idx" ON "turnos"("empresa_id", "inicio");
CREATE INDEX "turnos_recurso_id_inicio_idx" ON "turnos"("recurso_id", "inicio");

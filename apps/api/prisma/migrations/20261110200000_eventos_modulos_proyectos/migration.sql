-- AlterTable: Configuración de módulos estilo Odoo (4 - Módulos que se prenden y apagan)
ALTER TABLE "configuracion_empresa" ADD COLUMN "modulos" JSONB NOT NULL DEFAULT '{}';

-- CreateTable: Cola de eventos outbox y automatizaciones (1c - Automatizaciones Etapa 1)
CREATE TABLE "eventos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "empresa_id" UUID,
    "tipo" VARCHAR(60) NOT NULL,
    "payload" JSONB NOT NULL,
    "clave" VARCHAR(200),
    "estado" VARCHAR(12) NOT NULL DEFAULT 'pendiente',
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "max_intentos" INTEGER NOT NULL DEFAULT 6,
    "disponible_desde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bloqueado_hasta" TIMESTAMP(3),
    "ultimo_error" VARCHAR(1000),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "procesado_en" TIMESTAMP(3),

    CONSTRAINT "eventos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "eventos_ejecuciones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "evento_id" UUID NOT NULL,
    "intento" INTEGER NOT NULL,
    "resultado" VARCHAR(8) NOT NULL,
    "detalle" VARCHAR(500),
    "error" VARCHAR(1000),
    "duracion_ms" INTEGER NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_ejecuciones_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "automatizaciones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "empresa_id" UUID NOT NULL,
    "receta" VARCHAR(60) NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automatizaciones_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "eventos_empresa_id_tipo_clave_key" ON "eventos"("empresa_id", "tipo", "clave");
CREATE INDEX "eventos_estado_disponible_desde_idx" ON "eventos"("estado", "disponible_desde");
CREATE INDEX "eventos_empresa_id_creado_en_idx" ON "eventos"("empresa_id", "creado_en");
CREATE INDEX "eventos_ejecuciones_evento_id_idx" ON "eventos_ejecuciones"("evento_id");
CREATE UNIQUE INDEX "automatizaciones_empresa_id_receta_key" ON "automatizaciones"("empresa_id", "receta");

ALTER TABLE "eventos_ejecuciones" ADD CONSTRAINT "eventos_ejecuciones_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "eventos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: Proyectos Fase 1 (5 - Proyectos - Fase 1)
CREATE TABLE "plantillas_proyecto" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "empresa_id" UUID NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "descripcion" VARCHAR(500),
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plantillas_proyecto_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "plantillas_etapa" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "plantilla_id" UUID NOT NULL,
    "orden" INTEGER NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "dias_objetivo" INTEGER,
    "aprobacion" VARCHAR(10) NOT NULL DEFAULT 'ninguna',
    "aprobador_interno_id" UUID,

    CONSTRAINT "plantillas_etapa_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "proyectos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "empresa_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "cliente_id" UUID,
    "cliente_nombre" TEXT,
    "descripcion" VARCHAR(4000),
    "estado" VARCHAR(12) NOT NULL DEFAULT 'activo',
    "responsable_id" UUID,
    "plantilla_id" UUID,
    "plantilla_nombre" VARCHAR(120),
    "fecha_inicio" DATE NOT NULL,
    "fecha_comprometida" DATE,
    "monto_acordado" DECIMAL(14,2),
    "presupuesto_id" UUID,
    "terminado_en" TIMESTAMP(3),
    "motivo_cancelacion" VARCHAR(300),
    "usuario_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proyectos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "proyectos_miembros" (
    "proyecto_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,

    CONSTRAINT "proyectos_miembros_pkey" PRIMARY KEY ("proyecto_id","usuario_id")
);

CREATE TABLE "proyectos_etapas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "proyecto_id" UUID NOT NULL,
    "orden" INTEGER NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "estado" VARCHAR(12) NOT NULL DEFAULT 'pendiente',
    "aprobacion" VARCHAR(10) NOT NULL DEFAULT 'ninguna',
    "falta" VARCHAR(8),
    "responsable_id" UUID,
    "aprobador_interno_id" UUID,
    "fecha_objetivo" DATE,
    "version" INTEGER NOT NULL DEFAULT 1,
    "iniciada_en" TIMESTAMP(3),
    "en_revision_desde" TIMESTAMP(3),
    "cerrada_en" TIMESTAMP(3),
    "minutos_trabajo" INTEGER NOT NULL DEFAULT 0,
    "minutos_espera" INTEGER NOT NULL DEFAULT 0,
    "rondas_cambios" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "proyectos_etapas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "proyectos_aprobaciones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "etapa_id" UUID NOT NULL,
    "tipo" VARCHAR(8) NOT NULL,
    "resultado" VARCHAR(8) NOT NULL,
    "version" INTEGER NOT NULL,
    "aprobador_usuario_id" UUID,
    "aprobador_nombre" VARCHAR(160) NOT NULL,
    "medio" VARCHAR(12) NOT NULL,
    "comentario" VARCHAR(2000),
    "evidencia_url" VARCHAR(500),
    "aprobado_en" TIMESTAMP(3) NOT NULL,
    "registrado_por_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proyectos_aprobaciones_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "proyectos_eventos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "proyecto_id" UUID NOT NULL,
    "etapa_id" UUID,
    "tipo" VARCHAR(20) NOT NULL,
    "detalle" JSONB,
    "usuario_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proyectos_eventos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "plantillas_proyecto_empresa_id_idx" ON "plantillas_proyecto"("empresa_id");
CREATE INDEX "plantillas_etapa_plantilla_id_idx" ON "plantillas_etapa"("plantilla_id");
CREATE UNIQUE INDEX "proyectos_presupuesto_id_key" ON "proyectos"("presupuesto_id");
CREATE UNIQUE INDEX "proyectos_empresa_id_numero_key" ON "proyectos"("empresa_id", "numero");
CREATE INDEX "proyectos_empresa_id_estado_idx" ON "proyectos"("empresa_id", "estado");
CREATE INDEX "proyectos_etapas_proyecto_id_idx" ON "proyectos_etapas"("proyecto_id");
CREATE INDEX "proyectos_aprobaciones_etapa_id_idx" ON "proyectos_aprobaciones"("etapa_id");
CREATE INDEX "proyectos_eventos_proyecto_id_created_at_idx" ON "proyectos_eventos"("proyecto_id", "created_at");

ALTER TABLE "plantillas_etapa" ADD CONSTRAINT "plantillas_etapa_plantilla_id_fkey" FOREIGN KEY ("plantilla_id") REFERENCES "plantillas_proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "proyectos_miembros" ADD CONSTRAINT "proyectos_miembros_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "proyectos_etapas" ADD CONSTRAINT "proyectos_etapas_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "proyectos_aprobaciones" ADD CONSTRAINT "proyectos_aprobaciones_etapa_id_fkey" FOREIGN KEY ("etapa_id") REFERENCES "proyectos_etapas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "proyectos_eventos" ADD CONSTRAINT "proyectos_eventos_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

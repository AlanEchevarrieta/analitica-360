-- Archivo de documentos del negocio (plan Pro), con vencimientos.
CREATE TABLE "archivo_documentos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "empresa_id" UUID NOT NULL,
    "titulo" VARCHAR(160) NOT NULL,
    "categoria" VARCHAR(30) NOT NULL DEFAULT 'otro',
    "entidad_tipo" VARCHAR(20) NOT NULL DEFAULT 'empresa',
    "entidad_id" UUID,
    "nombre" VARCHAR(200) NOT NULL,
    "mime" VARCHAR(120) NOT NULL,
    "tamano" INTEGER NOT NULL,
    "clave" VARCHAR(120) NOT NULL,
    "vence" DATE,
    "avisado_30" TIMESTAMP(3),
    "avisado_7" TIMESTAMP(3),
    "notas" VARCHAR(1000),
    "usuario_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "archivo_documentos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "archivo_documentos_empresa_id_entidad_tipo_entidad_id_idx" ON "archivo_documentos"("empresa_id", "entidad_tipo", "entidad_id");
CREATE INDEX "archivo_documentos_empresa_id_vence_idx" ON "archivo_documentos"("empresa_id", "vence");

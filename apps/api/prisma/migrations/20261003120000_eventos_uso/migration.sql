-- CreateTable
CREATE TABLE "eventos_uso" (
    "id" BIGSERIAL NOT NULL,
    "empresa_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "sesion" VARCHAR(40) NOT NULL,
    "tipo" VARCHAR(10) NOT NULL,
    "ruta" VARCHAR(200) NOT NULL,
    "objetivo" VARCHAR(80),
    "dispositivo" VARCHAR(12),
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_uso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "eventos_uso_creado_en_idx" ON "eventos_uso"("creado_en");

-- CreateIndex
CREATE INDEX "eventos_uso_usuario_id_creado_en_idx" ON "eventos_uso"("usuario_id", "creado_en");

-- CreateIndex
CREATE INDEX "eventos_uso_empresa_id_creado_en_idx" ON "eventos_uso"("empresa_id", "creado_en");

-- AddForeignKey
ALTER TABLE "eventos_uso" ADD CONSTRAINT "eventos_uso_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_uso" ADD CONSTRAINT "eventos_uso_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;


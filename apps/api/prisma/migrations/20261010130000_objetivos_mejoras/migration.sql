-- Objetivos: 4 tipos nuevos, meta propia por período y avisos cuando un objetivo no llega.

ALTER TABLE "objetivos" DROP CONSTRAINT "objetivos_tipo_check";
ALTER TABLE "objetivos" ADD CONSTRAINT "objetivos_tipo_check" CHECK ("tipo" IN ('facturacion', 'ganancia', 'produccion', 'despachos', 'dias_despacho', 'a_tiempo', 'clientes_nuevos', 'ticket_promedio', 'unidades', 'cobranza'));

-- CreateTable
CREATE TABLE "objetivo_metas" (
    "objetivo_id" UUID NOT NULL,
    "desde" DATE NOT NULL,
    "meta" DECIMAL(16,2) NOT NULL,

    CONSTRAINT "objetivo_metas_pkey" PRIMARY KEY ("objetivo_id","desde")
);

-- CreateTable
CREATE TABLE "objetivo_avisos" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "objetivo_id" UUID NOT NULL,
    "desde" DATE NOT NULL,
    "usuario_id" UUID NOT NULL,
    "mensaje" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leido_en" TIMESTAMP(3),

    CONSTRAINT "objetivo_avisos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "objetivo_avisos_usuario_id_leido_en_idx" ON "objetivo_avisos"("usuario_id", "leido_en");

-- CreateIndex
CREATE UNIQUE INDEX "objetivo_avisos_objetivo_id_desde_usuario_id_key" ON "objetivo_avisos"("objetivo_id", "desde", "usuario_id");

-- AddForeignKey
ALTER TABLE "objetivo_metas" ADD CONSTRAINT "objetivo_metas_objetivo_id_fkey" FOREIGN KEY ("objetivo_id") REFERENCES "objetivos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objetivo_avisos" ADD CONSTRAINT "objetivo_avisos_objetivo_id_fkey" FOREIGN KEY ("objetivo_id") REFERENCES "objetivos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objetivo_avisos" ADD CONSTRAINT "objetivo_avisos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "objetivo_metas" ADD CONSTRAINT "objetivo_metas_meta_check" CHECK ("meta" > 0);

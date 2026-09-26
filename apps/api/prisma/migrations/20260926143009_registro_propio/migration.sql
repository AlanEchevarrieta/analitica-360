-- AlterTable
ALTER TABLE "empresas" ADD COLUMN     "origen_registro" TEXT,
ADD COLUMN     "telefono" TEXT;

-- CreateTable
CREATE TABLE "avisos_admin" (
    "id" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "detalle" JSONB NOT NULL DEFAULT '{}',
    "empresa_id" UUID,
    "leido" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avisos_admin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "avisos_admin_leido_created_at_idx" ON "avisos_admin"("leido", "created_at");

-- AddForeignKey
ALTER TABLE "avisos_admin" ADD CONSTRAINT "avisos_admin_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

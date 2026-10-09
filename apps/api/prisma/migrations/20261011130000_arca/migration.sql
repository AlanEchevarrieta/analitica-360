-- Facturación electrónica (ARCA): configuración por empresa, comprobantes con CAE y permiso de acceso del WSAA.
-- CreateTable
CREATE TABLE "arca_config" (
    "empresa_id" UUID NOT NULL,
    "cuit" TEXT NOT NULL,
    "razon_social" TEXT NOT NULL,
    "domicilio" TEXT NOT NULL,
    "inicio_actividades" DATE,
    "iibb" TEXT,
    "punto_venta" INTEGER NOT NULL,
    "verificado_en" TIMESTAMP(3),
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "arca_config_pkey" PRIMARY KEY ("empresa_id")
);

-- CreateTable
CREATE TABLE "comprobantes" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "venta_id" UUID,
    "tipo" INTEGER NOT NULL,
    "punto_venta" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "doc_tipo" INTEGER NOT NULL,
    "doc_nro" TEXT NOT NULL,
    "receptor_nombre" TEXT,
    "condicion_iva_receptor" INTEGER NOT NULL,
    "cae" TEXT NOT NULL,
    "cae_vence" DATE NOT NULL,
    "ambiente" TEXT NOT NULL,
    "asociado_id" UUID,
    "usuario_id" UUID,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comprobantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arca_tickets" (
    "ambiente" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "firma" TEXT NOT NULL,
    "vence" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "arca_tickets_pkey" PRIMARY KEY ("ambiente")
);

-- CreateIndex
CREATE INDEX "comprobantes_empresa_id_fecha_idx" ON "comprobantes"("empresa_id", "fecha");

-- CreateIndex
CREATE INDEX "comprobantes_venta_id_idx" ON "comprobantes"("venta_id");

-- CreateIndex
CREATE UNIQUE INDEX "comprobantes_empresa_id_ambiente_tipo_punto_venta_numero_key" ON "comprobantes"("empresa_id", "ambiente", "tipo", "punto_venta", "numero");

-- AddForeignKey
ALTER TABLE "arca_config" ADD CONSTRAINT "arca_config_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes" ADD CONSTRAINT "comprobantes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes" ADD CONSTRAINT "comprobantes_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Una sola factura C por venta (las notas de crédito van aparte).
CREATE UNIQUE INDEX "comprobantes_una_factura_por_venta" ON "comprobantes"("venta_id", "ambiente") WHERE "tipo" = 11;
ALTER TABLE "comprobantes" ADD CONSTRAINT "comprobantes_tipo_check" CHECK ("tipo" IN (11, 12, 13));

-- CreateTable
CREATE TABLE "cobros_clientes" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "cliente_id" UUID,
    "monto" DECIMAL(12,2) NOT NULL,
    "forma_pago" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "notas" TEXT,
    "usuario_id" UUID NOT NULL,
    "anulado_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cobros_clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cobros_aplicaciones" (
    "id" UUID NOT NULL,
    "cobro_id" UUID NOT NULL,
    "venta_id" UUID NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "cobros_aplicaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cobros_clientes_empresa_id_fecha_idx" ON "cobros_clientes"("empresa_id", "fecha");

-- CreateIndex
CREATE INDEX "cobros_clientes_cliente_id_idx" ON "cobros_clientes"("cliente_id");

-- CreateIndex
CREATE INDEX "cobros_aplicaciones_cobro_id_idx" ON "cobros_aplicaciones"("cobro_id");

-- CreateIndex
CREATE INDEX "cobros_aplicaciones_venta_id_idx" ON "cobros_aplicaciones"("venta_id");

-- AddForeignKey
ALTER TABLE "cobros_clientes" ADD CONSTRAINT "cobros_clientes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobros_clientes" ADD CONSTRAINT "cobros_clientes_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobros_aplicaciones" ADD CONSTRAINT "cobros_aplicaciones_cobro_id_fkey" FOREIGN KEY ("cobro_id") REFERENCES "cobros_clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobros_aplicaciones" ADD CONSTRAINT "cobros_aplicaciones_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

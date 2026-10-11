-- Presupuestos: cotizaciones a clientes que se pasan a venta con un clic.
CREATE TABLE "presupuestos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "empresa_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "cliente_id" UUID,
    "cliente_nombre" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valido_hasta" DATE NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    "descuento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notas" TEXT,
    "venta_id" UUID,
    "usuario_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "presupuestos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "presupuestos_venta_id_key" ON "presupuestos"("venta_id");
CREATE UNIQUE INDEX "presupuestos_empresa_id_numero_key" ON "presupuestos"("empresa_id", "numero");
CREATE INDEX "presupuestos_empresa_id_fecha_idx" ON "presupuestos"("empresa_id", "fecha");

CREATE TABLE "presupuestos_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "presupuesto_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "variante_id" UUID,
    "descripcion" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio_unitario" DECIMAL(12,2) NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "presupuestos_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "presupuestos_items_presupuesto_id_idx" ON "presupuestos_items"("presupuesto_id");
ALTER TABLE "presupuestos_items" ADD CONSTRAINT "presupuestos_items_presupuesto_id_fkey" FOREIGN KEY ("presupuesto_id") REFERENCES "presupuestos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

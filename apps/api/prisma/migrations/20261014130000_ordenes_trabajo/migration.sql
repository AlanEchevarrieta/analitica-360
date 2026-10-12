-- Módulo de servicios, pieza 2: órdenes de trabajo (recepción, etapas, seña y entrega).
CREATE TABLE "ordenes_trabajo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "empresa_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "cliente_id" UUID,
    "cliente_nombre" TEXT,
    "cliente_telefono" VARCHAR(40),
    "equipo" VARCHAR(300) NOT NULL,
    "problema" VARCHAR(2000),
    "notas_internas" VARCHAR(2000),
    "estado" VARCHAR(20) NOT NULL DEFAULT 'recibido',
    "responsable_id" UUID,
    "fecha_prometida" DATE,
    "descuento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "presupuesto_id" UUID,
    "senia_cobro_id" UUID,
    "venta_id" UUID,
    "entregada_en" TIMESTAMP(3),
    "usuario_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ordenes_trabajo_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ordenes_trabajo_presupuesto_id_key" ON "ordenes_trabajo"("presupuesto_id");
CREATE UNIQUE INDEX "ordenes_trabajo_senia_cobro_id_key" ON "ordenes_trabajo"("senia_cobro_id");
CREATE UNIQUE INDEX "ordenes_trabajo_venta_id_key" ON "ordenes_trabajo"("venta_id");
CREATE UNIQUE INDEX "ordenes_trabajo_empresa_id_numero_key" ON "ordenes_trabajo"("empresa_id", "numero");
CREATE INDEX "ordenes_trabajo_empresa_id_estado_idx" ON "ordenes_trabajo"("empresa_id", "estado");

CREATE TABLE "ordenes_trabajo_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orden_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "variante_id" UUID,
    "descripcion" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio_unitario" DECIMAL(12,2) NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ordenes_trabajo_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ordenes_trabajo_items_orden_id_idx" ON "ordenes_trabajo_items"("orden_id");
ALTER TABLE "ordenes_trabajo_items" ADD CONSTRAINT "ordenes_trabajo_items_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "ordenes_trabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ordenes_trabajo_estados" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orden_id" UUID NOT NULL,
    "estado" VARCHAR(20) NOT NULL,
    "usuario_id" UUID,
    "nota" VARCHAR(300),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ordenes_trabajo_estados_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ordenes_trabajo_estados_orden_id_idx" ON "ordenes_trabajo_estados"("orden_id");
ALTER TABLE "ordenes_trabajo_estados" ADD CONSTRAINT "ordenes_trabajo_estados_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "ordenes_trabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

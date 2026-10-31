-- Migración para Control de Cajas, Turnos y Arqueo (Cierre X y Z)

CREATE TABLE "cajas_sesiones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "empresa_id" UUID NOT NULL,
    "usuario_apertura_id" UUID NOT NULL,
    "usuario_cierre_id" UUID,
    "ubicacion_id" UUID,
    "nombre_caja" VARCHAR(50) NOT NULL DEFAULT 'Caja Principal',
    "estado" VARCHAR(20) NOT NULL DEFAULT 'abierta',
    "monto_inicial" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "fecha_apertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_cierre" TIMESTAMP(3),
    "monto_declarado" DECIMAL(12,2),
    "monto_esperado" DECIMAL(12,2),
    "diferencia" DECIMAL(12,2),
    "total_ventas_efectivo" DECIMAL(12,2),
    "total_ventas_digital" DECIMAL(12,2),
    "total_ingresos" DECIMAL(12,2),
    "total_egresos" DECIMAL(12,2),
    "notas_apertura" TEXT,
    "notas_cierre" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cajas_sesiones_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cajas_sesiones_empresa_id_estado_idx" ON "cajas_sesiones"("empresa_id", "estado");
CREATE INDEX "cajas_sesiones_empresa_id_fecha_apertura_idx" ON "cajas_sesiones"("empresa_id", "fecha_apertura");

ALTER TABLE "cajas_sesiones" ADD CONSTRAINT "cajas_sesiones_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cajas_sesiones" ADD CONSTRAINT "cajas_sesiones_usuario_apertura_id_fkey" FOREIGN KEY ("usuario_apertura_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cajas_sesiones" ADD CONSTRAINT "cajas_sesiones_usuario_cierre_id_fkey" FOREIGN KEY ("usuario_cierre_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cajas_sesiones" ADD CONSTRAINT "cajas_sesiones_ubicacion_id_fkey" FOREIGN KEY ("ubicacion_id") REFERENCES "ubicaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "cajas_movimientos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "caja_sesion_id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "concepto" TEXT NOT NULL,
    "comprobante_ref" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cajas_movimientos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cajas_movimientos_caja_sesion_id_idx" ON "cajas_movimientos"("caja_sesion_id");
CREATE INDEX "cajas_movimientos_empresa_id_fecha_idx" ON "cajas_movimientos"("empresa_id", "fecha");

ALTER TABLE "cajas_movimientos" ADD CONSTRAINT "cajas_movimientos_caja_sesion_id_fkey" FOREIGN KEY ("caja_sesion_id") REFERENCES "cajas_sesiones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cajas_movimientos" ADD CONSTRAINT "cajas_movimientos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cajas_movimientos" ADD CONSTRAINT "cajas_movimientos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Vincular venta a sesión de caja
ALTER TABLE "ventas" ADD COLUMN "caja_sesion_id" UUID;
CREATE INDEX "ventas_caja_sesion_id_idx" ON "ventas"("caja_sesion_id");
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_caja_sesion_id_fkey" FOREIGN KEY ("caja_sesion_id") REFERENCES "cajas_sesiones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

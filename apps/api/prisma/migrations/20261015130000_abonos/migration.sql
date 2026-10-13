-- Módulo de servicios, pieza 4: abonos (planes, abonos de clientes, períodos cobrados y sesiones usadas).
CREATE TABLE "abono_planes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "empresa_id" UUID NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "tipo" VARCHAR(10) NOT NULL DEFAULT 'mensual',
    "precio" DECIMAL(12,2) NOT NULL,
    "sesiones" INTEGER,
    "vigencia_dias" INTEGER,
    "producto_id" UUID NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "abono_planes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "abono_planes_empresa_id_idx" ON "abono_planes"("empresa_id");

CREATE TABLE "abonos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "empresa_id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "precio" DECIMAL(12,2) NOT NULL,
    "estado" VARCHAR(10) NOT NULL DEFAULT 'activo',
    "notas" VARCHAR(500),
    "baja_en" TIMESTAMP(3),
    "usuario_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "abonos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "abonos_empresa_id_estado_idx" ON "abonos"("empresa_id", "estado");
CREATE INDEX "abonos_cliente_id_idx" ON "abonos"("cliente_id");
ALTER TABLE "abonos" ADD CONSTRAINT "abonos_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "abono_planes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "abono_periodos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "empresa_id" UUID NOT NULL,
    "abono_id" UUID NOT NULL,
    "desde" DATE NOT NULL,
    "hasta" DATE NOT NULL,
    "sesiones" INTEGER,
    "usadas" INTEGER NOT NULL DEFAULT 0,
    "monto" DECIMAL(12,2) NOT NULL,
    "venta_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "abono_periodos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "abono_periodos_venta_id_key" ON "abono_periodos"("venta_id");
CREATE INDEX "abono_periodos_abono_id_hasta_idx" ON "abono_periodos"("abono_id", "hasta");
ALTER TABLE "abono_periodos" ADD CONSTRAINT "abono_periodos_abono_id_fkey" FOREIGN KEY ("abono_id") REFERENCES "abonos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "abono_usos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "empresa_id" UUID NOT NULL,
    "periodo_id" UUID NOT NULL,
    "turno_id" UUID,
    "fecha" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuario_id" UUID,
    "nota" VARCHAR(200),
    CONSTRAINT "abono_usos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "abono_usos_turno_id_key" ON "abono_usos"("turno_id");
CREATE INDEX "abono_usos_periodo_id_idx" ON "abono_usos"("periodo_id");
ALTER TABLE "abono_usos" ADD CONSTRAINT "abono_usos_periodo_id_fkey" FOREIGN KEY ("periodo_id") REFERENCES "abono_periodos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

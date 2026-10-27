-- Migración para el motor unificado de pasarelas de pago (Mercado Pago, Ualá Bis, Stripe)
CREATE TABLE "empresa_pasarelas_config" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "empresa_id" UUID NOT NULL,
    "proveedor" VARCHAR(20) NOT NULL,
    "habilitado" BOOLEAN NOT NULL DEFAULT true,
    "credenciales" TEXT NOT NULL,
    "public_key" TEXT,
    "webhook_secret" TEXT,
    "uso_tienda" BOOLEAN NOT NULL DEFAULT true,
    "uso_pos" BOOLEAN NOT NULL DEFAULT true,
    "uso_cuentas" BOOLEAN NOT NULL DEFAULT true,
    "uso_turnos" BOOLEAN NOT NULL DEFAULT true,
    "conectado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresa_pasarelas_config_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "empresa_pasarelas_config_empresa_id_proveedor_key" ON "empresa_pasarelas_config"("empresa_id", "proveedor");

ALTER TABLE "empresa_pasarelas_config" ADD CONSTRAINT "empresa_pasarelas_config_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "pasarela_transacciones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "empresa_id" UUID NOT NULL,
    "proveedor" VARCHAR(20) NOT NULL,
    "origen_tipo" VARCHAR(30) NOT NULL,
    "origen_id" UUID,
    "id_externo" TEXT,
    "url_pago" TEXT,
    "qr_data" TEXT,
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'ARS',
    "monto_bruto" DECIMAL(12,2) NOT NULL,
    "comision_estimada" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "monto_neto" DECIMAL(12,2),
    "estado" VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    "cliente_nombre" TEXT,
    "cliente_email" TEXT,
    "concepto" TEXT,
    "metadata" JSONB,
    "expira_en" TIMESTAMP(3),
    "pagado_en" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pasarela_transacciones_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pasarela_transacciones_empresa_id_origen_tipo_origen_id_idx" ON "pasarela_transacciones"("empresa_id", "origen_tipo", "origen_id");
CREATE INDEX "pasarela_transacciones_proveedor_id_externo_idx" ON "pasarela_transacciones"("proveedor", "id_externo");

ALTER TABLE "pasarela_transacciones" ADD CONSTRAINT "pasarela_transacciones_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

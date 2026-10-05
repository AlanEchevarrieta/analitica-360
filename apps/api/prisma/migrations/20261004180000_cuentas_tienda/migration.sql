-- CreateTable
CREATE TABLE "cuentas_tienda" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "google_sub" VARCHAR(64),
    "nombre" VARCHAR(120),
    "telefono" VARCHAR(40),
    "calle" VARCHAR(120),
    "numero" VARCHAR(20),
    "piso" VARCHAR(40),
    "ciudad" VARCHAR(80),
    "provincia" VARCHAR(60),
    "codigo_postal" VARCHAR(12),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimo_ingreso" TIMESTAMP(3),

    CONSTRAINT "cuentas_tienda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "codigos_ingreso_tienda" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "codigo_hash" VARCHAR(64) NOT NULL,
    "expira" TIMESTAMP(3) NOT NULL,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "usado" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "codigos_ingreso_tienda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesiones_tienda" (
    "id" UUID NOT NULL,
    "cuenta_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expira" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sesiones_tienda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favoritos_tienda" (
    "cuenta_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favoritos_tienda_pkey" PRIMARY KEY ("cuenta_id","producto_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_tienda_cliente_id_key" ON "cuentas_tienda"("cliente_id");

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_tienda_empresa_id_email_key" ON "cuentas_tienda"("empresa_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_tienda_empresa_id_google_sub_key" ON "cuentas_tienda"("empresa_id", "google_sub");

-- CreateIndex
CREATE INDEX "codigos_ingreso_tienda_empresa_id_email_created_at_idx" ON "codigos_ingreso_tienda"("empresa_id", "email", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sesiones_tienda_token_hash_key" ON "sesiones_tienda"("token_hash");

-- CreateIndex
CREATE INDEX "sesiones_tienda_cuenta_id_idx" ON "sesiones_tienda"("cuenta_id");

-- AddForeignKey
ALTER TABLE "cuentas_tienda" ADD CONSTRAINT "cuentas_tienda_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_tienda" ADD CONSTRAINT "cuentas_tienda_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones_tienda" ADD CONSTRAINT "sesiones_tienda_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "cuentas_tienda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favoritos_tienda" ADD CONSTRAINT "favoritos_tienda_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "cuentas_tienda"("id") ON DELETE CASCADE ON UPDATE CASCADE;


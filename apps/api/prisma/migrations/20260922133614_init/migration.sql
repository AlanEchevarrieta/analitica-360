-- CreateEnum
CREATE TYPE "RolCrudo" AS ENUM ('dueno', 'administrador', 'operario', 'operador', 'contador', 'visor');

-- CreateTable
CREATE TABLE "empresas" (
    "id" UUID NOT NULL,
    "clerk_org_id" TEXT,
    "nombre" TEXT NOT NULL,
    "rubro" TEXT,
    "plan_actual" TEXT NOT NULL DEFAULT 'starter',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "es_demo" BOOLEAN NOT NULL DEFAULT false,
    "umbral_confirmacion" DECIMAL(12,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_planes" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "plan_anterior" TEXT,
    "plan_nuevo" TEXT NOT NULL,
    "fecha_cambio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivo" TEXT,

    CONSTRAINT "historial_planes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planes" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "precio_ars" DECIMAL(12,2),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suscripciones" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "plan_id" UUID,
    "estado" TEXT NOT NULL DEFAULT 'periodo_prueba',
    "fecha_inicio" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_vencimiento" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suscripciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aceptaciones_terminos" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "version" TEXT NOT NULL,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aceptaciones_terminos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_emails" (
    "email" TEXT NOT NULL,

    CONSTRAINT "admin_emails_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "clerk_user_id" TEXT,
    "empresa_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "rol" "RolCrudo" NOT NULL DEFAULT 'operador',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "permisos" JSONB NOT NULL DEFAULT '{}',
    "invitado_por" UUID,
    "invitacion_pendiente" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracion_empresa" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "medios_pago" JSONB NOT NULL DEFAULT '["efectivo","transferencia","debito","credito","mp_qr"]',
    "tasas_cuotas" JSONB NOT NULL,
    "flujo_ventas" JSONB NOT NULL DEFAULT '{"mostrar_cliente":"opcional","crear_desde_venta":true}',
    "inventario" JSONB NOT NULL DEFAULT '{"umbral_stock_bajo":5}',
    "ubicacion_venta_default" TEXT,
    "modo_asignacion" TEXT NOT NULL DEFAULT 'manual',
    "asignacion_fija_usuario_id" UUID,
    "asignacion_rotacion_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "pais" TEXT NOT NULL DEFAULT 'argentina',
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "simbolo_moneda" TEXT NOT NULL DEFAULT '$',
    "alicuota_iva" DECIMAL(5,2) NOT NULL DEFAULT 21.00,
    "nombre_iva" TEXT NOT NULL DEFAULT 'IVA',
    "mostrar_iva_ventas" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "configuracion_empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT,
    "categoria_id" UUID,
    "codigo_barra" TEXT,
    "precio_venta" DECIMAL(12,2),
    "costo" DECIMAL(12,2),
    "usa_variantes" BOOLEAN NOT NULL DEFAULT false,
    "alto_cm" DECIMAL(8,2),
    "largo_cm" DECIMAL(8,2),
    "ancho_cm" DECIMAL(8,2),
    "peso_gr" DECIMAL(10,2),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "precios_historial" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "variante" TEXT,
    "precio_venta" DECIMAL(12,2) NOT NULL,
    "costo" DECIMAL(12,2) NOT NULL,
    "fecha_desde" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "moneda_costo" TEXT DEFAULT 'ARS',
    "tipo_cambio" DECIMAL(10,2),

    CONSTRAINT "precios_historial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atributos" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "valores" TEXT[],
    "activo_ventas" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atributos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producto_variantes" (
    "id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "sku" TEXT,
    "atributos" JSONB NOT NULL DEFAULT '{}',
    "precio_venta" DECIMAL(12,2),
    "costo" DECIMAL(12,2),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "producto_variantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ubicaciones" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'otro',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ubicaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lotes" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "variante_id" UUID,
    "numero_lote" TEXT NOT NULL,
    "fecha_vencimiento" DATE,
    "fecha_elaboracion" DATE,
    "cantidad_inicial" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "proveedor_id" UUID,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_inventario" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "variante_id" UUID,
    "lote_id" UUID,
    "usuario_id" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "cantidad" DECIMAL(12,2) NOT NULL,
    "signo" SMALLINT NOT NULL,
    "costo_unitario" DECIMAL(12,2),
    "precio_unitario" DECIMAL(12,2),
    "motivo" TEXT,
    "ubicacion_origen" TEXT,
    "ubicacion_destino" TEXT,
    "referencia_id" UUID,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "movimientos_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ventas_numeracion" (
    "empresa_id" UUID NOT NULL,
    "ultimo" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "ventas_numeracion_pkey" PRIMARY KEY ("empresa_id")
);

-- CreateTable
CREATE TABLE "ventas" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "cliente_id" UUID,
    "numero_venta" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "forma_pago" TEXT NOT NULL,
    "descuento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cliente_nombre" TEXT,
    "canal" TEXT DEFAULT 'mostrador',
    "notas" TEXT,
    "cuotas" INTEGER NOT NULL DEFAULT 1,
    "coeficiente_interes" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "total_sin_interes" DECIMAL(12,2),
    "total_con_interes" DECIMAL(12,2),
    "es_senia" BOOLEAN NOT NULL DEFAULT false,
    "monto_senia" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "saldo_pendiente" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "estado_cobro" TEXT NOT NULL DEFAULT 'pagado',
    "fecha_cobro_saldo" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "ventas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ventas_items" (
    "id" UUID NOT NULL,
    "venta_id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "variante_id" UUID,
    "cantidad" INTEGER NOT NULL,
    "precio_unitario" DECIMAL(12,2) NOT NULL,
    "costo_unitario" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "ventas_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anulaciones" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "venta_id" UUID NOT NULL,
    "usuario_id" UUID,
    "motivo" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anulaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devoluciones" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "usuario_id" UUID,
    "venta_id" UUID,
    "numero" INTEGER,
    "tipo" TEXT NOT NULL,
    "motivo" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notas" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devoluciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devoluciones_items" (
    "id" UUID NOT NULL,
    "devolucion_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "variante_id" UUID,
    "cantidad" DECIMAL(12,2) NOT NULL,
    "precio_unitario" DECIMAL(12,2) NOT NULL,
    "tipo" TEXT NOT NULL,

    CONSTRAINT "devoluciones_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proveedores" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "razon_social" TEXT,
    "nombre_comercial" TEXT,
    "cuit" TEXT,
    "condicion_afip" TEXT,
    "contacto" TEXT,
    "nombre_vendedor" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "productos_que_provee" TEXT,
    "condiciones_pago" TEXT,
    "formas_pago_aceptadas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "plazo_entrega" TEXT,
    "cbu" TEXT,
    "alias_cbu" TEXT,
    "banco" TEXT,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compras" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "usuario_id" UUID,
    "proveedor" TEXT,
    "proveedor_id" UUID,
    "orden_compra_id" UUID,
    "fecha" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total" DECIMAL(12,2),
    "costo_flete" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "costo_impuestos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "costo_otros" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "descripcion_otros" TEXT,
    "total_costos_adicionales" DECIMAL(12,2),
    "total_real" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "imagen_factura_url" TEXT,
    "notas" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compras_items" (
    "id" UUID NOT NULL,
    "compra_id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "producto_id" UUID,
    "variante_id" UUID,
    "producto_nombre" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "costo_unitario" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "compras_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordenes_compra_numeracion" (
    "empresa_id" UUID NOT NULL,
    "ultimo" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "ordenes_compra_numeracion_pkey" PRIMARY KEY ("empresa_id")
);

-- CreateTable
CREATE TABLE "ordenes_compra" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "proveedor_id" UUID,
    "numero_oc" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'borrador',
    "fecha_emision" DATE,
    "fecha_entrega_estimada" DATE,
    "notas" TEXT,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ordenes_compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordenes_compra_items" (
    "id" UUID NOT NULL,
    "orden_compra_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "variante_id" UUID,
    "cantidad_pedida" DECIMAL(12,2) NOT NULL,
    "precio_unitario" DECIMAL(12,2) NOT NULL,
    "cantidad_recibida" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "recibido" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ordenes_compra_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedidos_numeracion" (
    "empresa_id" UUID NOT NULL,
    "ultimo" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "pedidos_numeracion_pkey" PRIMARY KEY ("empresa_id")
);

-- CreateTable
CREATE TABLE "pedidos" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "numero_pedido" TEXT NOT NULL,
    "cliente_id" UUID,
    "cliente_nombre" TEXT,
    "cliente_email" TEXT,
    "cliente_telefono" TEXT,
    "origen" TEXT NOT NULL DEFAULT 'manual',
    "estado" TEXT NOT NULL DEFAULT 'nuevo',
    "direccion_envio" TEXT,
    "codigo_postal" TEXT,
    "localidad" TEXT,
    "provincia" TEXT,
    "metodo_envio" TEXT,
    "numero_seguimiento" TEXT,
    "remitente_nombre" TEXT,
    "remitente_direccion" TEXT,
    "remitente_telefono" TEXT,
    "remitente_email" TEXT,
    "asignado_a" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedidos_items" (
    "id" UUID NOT NULL,
    "pedido_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "variante_id" UUID,
    "lote_id" UUID,
    "cantidad" DECIMAL(12,2) NOT NULL,
    "precio_unitario" DECIMAL(12,2) NOT NULL,
    "cantidad_preparada" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "preparado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "pedidos_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "email" TEXT,
    "cumpleanos" DATE,
    "notas_libres" TEXT,
    "etiquetas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes_interacciones" (
    "id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "privado" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clientes_interacciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "difusiones" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "usuario_id" UUID,
    "segmento" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "cantidad_destinatarios" INTEGER NOT NULL DEFAULT 0,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "difusiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gastos" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "usuario_id" UUID,
    "categoria" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "fecha" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recurrente" BOOLEAN NOT NULL DEFAULT false,
    "frecuencia" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gastos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "usuario_id" UUID,
    "numero_ticket" TEXT,
    "asunto" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "categoria" TEXT NOT NULL DEFAULT 'consulta',
    "prioridad" TEXT NOT NULL DEFAULT 'media',
    "estado" TEXT NOT NULL DEFAULT 'abierto',
    "visto_cliente_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets_respuestas" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "autor_id" UUID,
    "es_admin" BOOLEAN NOT NULL DEFAULT false,
    "contenido" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tickets_respuestas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "monto_ars" DECIMAL(12,2) NOT NULL,
    "metodo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'confirmado',
    "periodo" DATE,
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitaciones_colaboradores" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "rol" "RolCrudo" NOT NULL DEFAULT 'operario',
    "invitado_por" UUID,
    "pendiente" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitaciones_colaboradores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colaborador_permisos" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "modulos" JSONB NOT NULL DEFAULT '{}',
    "acciones" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "colaborador_permisos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "empresas_clerk_org_id_key" ON "empresas"("clerk_org_id");

-- CreateIndex
CREATE INDEX "suscripciones_empresa_id_idx" ON "suscripciones"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_clerk_user_id_key" ON "usuarios"("clerk_user_id");

-- CreateIndex
CREATE INDEX "usuarios_empresa_id_idx" ON "usuarios"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "configuracion_empresa_empresa_id_key" ON "configuracion_empresa"("empresa_id");

-- CreateIndex
CREATE INDEX "productos_empresa_id_idx" ON "productos"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_empresa_id_nombre_key" ON "categorias"("empresa_id", "nombre");

-- CreateIndex
CREATE INDEX "precios_historial_empresa_id_producto_id_fecha_desde_idx" ON "precios_historial"("empresa_id", "producto_id", "fecha_desde");

-- CreateIndex
CREATE UNIQUE INDEX "ubicaciones_empresa_id_nombre_key" ON "ubicaciones"("empresa_id", "nombre");

-- CreateIndex
CREATE INDEX "movimientos_inventario_empresa_id_producto_id_fecha_idx" ON "movimientos_inventario"("empresa_id", "producto_id", "fecha");

-- CreateIndex
CREATE INDEX "ventas_empresa_id_fecha_idx" ON "ventas"("empresa_id", "fecha");

-- CreateIndex
CREATE INDEX "ventas_items_venta_id_idx" ON "ventas_items"("venta_id");

-- CreateIndex
CREATE INDEX "ventas_items_empresa_id_idx" ON "ventas_items"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "anulaciones_venta_id_key" ON "anulaciones"("venta_id");

-- CreateIndex
CREATE INDEX "proveedores_empresa_id_nombre_idx" ON "proveedores"("empresa_id", "nombre");

-- CreateIndex
CREATE INDEX "compras_empresa_id_fecha_idx" ON "compras"("empresa_id", "fecha");

-- CreateIndex
CREATE INDEX "compras_items_compra_id_idx" ON "compras_items"("compra_id");

-- CreateIndex
CREATE INDEX "clientes_empresa_id_idx" ON "clientes"("empresa_id");

-- CreateIndex
CREATE INDEX "gastos_empresa_id_fecha_idx" ON "gastos"("empresa_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_numero_ticket_key" ON "tickets"("numero_ticket");

-- CreateIndex
CREATE INDEX "tickets_respuestas_ticket_id_created_at_idx" ON "tickets_respuestas"("ticket_id", "created_at");

-- CreateIndex
CREATE INDEX "pagos_empresa_id_created_at_idx" ON "pagos"("empresa_id", "created_at");

-- CreateIndex
CREATE INDEX "invitaciones_colaboradores_empresa_id_pendiente_idx" ON "invitaciones_colaboradores"("empresa_id", "pendiente");

-- CreateIndex
CREATE UNIQUE INDEX "colaborador_permisos_usuario_id_key" ON "colaborador_permisos"("usuario_id");

-- AddForeignKey
ALTER TABLE "historial_planes" ADD CONSTRAINT "historial_planes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suscripciones" ADD CONSTRAINT "suscripciones_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suscripciones" ADD CONSTRAINT "suscripciones_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "planes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aceptaciones_terminos" ADD CONSTRAINT "aceptaciones_terminos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_invitado_por_fkey" FOREIGN KEY ("invitado_por") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuracion_empresa" ADD CONSTRAINT "configuracion_empresa_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuracion_empresa" ADD CONSTRAINT "configuracion_empresa_asignacion_fija_usuario_id_fkey" FOREIGN KEY ("asignacion_fija_usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "precios_historial" ADD CONSTRAINT "precios_historial_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "precios_historial" ADD CONSTRAINT "precios_historial_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atributos" ADD CONSTRAINT "atributos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_variantes" ADD CONSTRAINT "producto_variantes_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ubicaciones" ADD CONSTRAINT "ubicaciones_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_variante_id_fkey" FOREIGN KEY ("variante_id") REFERENCES "producto_variantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_variante_id_fkey" FOREIGN KEY ("variante_id") REFERENCES "producto_variantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas_numeracion" ADD CONSTRAINT "ventas_numeracion_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas_items" ADD CONSTRAINT "ventas_items_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas_items" ADD CONSTRAINT "ventas_items_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas_items" ADD CONSTRAINT "ventas_items_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas_items" ADD CONSTRAINT "ventas_items_variante_id_fkey" FOREIGN KEY ("variante_id") REFERENCES "producto_variantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anulaciones" ADD CONSTRAINT "anulaciones_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anulaciones" ADD CONSTRAINT "anulaciones_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anulaciones" ADD CONSTRAINT "anulaciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones" ADD CONSTRAINT "devoluciones_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones" ADD CONSTRAINT "devoluciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones" ADD CONSTRAINT "devoluciones_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_items" ADD CONSTRAINT "devoluciones_items_devolucion_id_fkey" FOREIGN KEY ("devolucion_id") REFERENCES "devoluciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_items" ADD CONSTRAINT "devoluciones_items_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_items" ADD CONSTRAINT "devoluciones_items_variante_id_fkey" FOREIGN KEY ("variante_id") REFERENCES "producto_variantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proveedores" ADD CONSTRAINT "proveedores_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "compras_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "compras_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "compras_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "compras_orden_compra_id_fkey" FOREIGN KEY ("orden_compra_id") REFERENCES "ordenes_compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras_items" ADD CONSTRAINT "compras_items_compra_id_fkey" FOREIGN KEY ("compra_id") REFERENCES "compras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras_items" ADD CONSTRAINT "compras_items_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras_items" ADD CONSTRAINT "compras_items_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras_items" ADD CONSTRAINT "compras_items_variante_id_fkey" FOREIGN KEY ("variante_id") REFERENCES "producto_variantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra_numeracion" ADD CONSTRAINT "ordenes_compra_numeracion_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra_items" ADD CONSTRAINT "ordenes_compra_items_orden_compra_id_fkey" FOREIGN KEY ("orden_compra_id") REFERENCES "ordenes_compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra_items" ADD CONSTRAINT "ordenes_compra_items_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra_items" ADD CONSTRAINT "ordenes_compra_items_variante_id_fkey" FOREIGN KEY ("variante_id") REFERENCES "producto_variantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_numeracion" ADD CONSTRAINT "pedidos_numeracion_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_asignado_a_fkey" FOREIGN KEY ("asignado_a") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_items" ADD CONSTRAINT "pedidos_items_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_items" ADD CONSTRAINT "pedidos_items_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_items" ADD CONSTRAINT "pedidos_items_variante_id_fkey" FOREIGN KEY ("variante_id") REFERENCES "producto_variantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_items" ADD CONSTRAINT "pedidos_items_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes_interacciones" ADD CONSTRAINT "clientes_interacciones_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes_interacciones" ADD CONSTRAINT "clientes_interacciones_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "difusiones" ADD CONSTRAINT "difusiones_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "difusiones" ADD CONSTRAINT "difusiones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets_respuestas" ADD CONSTRAINT "tickets_respuestas_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets_respuestas" ADD CONSTRAINT "tickets_respuestas_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitaciones_colaboradores" ADD CONSTRAINT "invitaciones_colaboradores_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaborador_permisos" ADD CONSTRAINT "colaborador_permisos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaborador_permisos" ADD CONSTRAINT "colaborador_permisos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

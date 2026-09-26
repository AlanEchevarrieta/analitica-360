-- CreateIndex
CREATE INDEX "compras_proveedor_id_idx" ON "compras"("proveedor_id");

-- CreateIndex
CREATE INDEX "compras_items_producto_id_idx" ON "compras_items"("producto_id");

-- CreateIndex
CREATE INDEX "devoluciones_venta_id_idx" ON "devoluciones"("venta_id");

-- CreateIndex
CREATE INDEX "devoluciones_items_devolucion_id_idx" ON "devoluciones_items"("devolucion_id");

-- CreateIndex
CREATE INDEX "movimientos_inventario_referencia_id_idx" ON "movimientos_inventario"("referencia_id");

-- CreateIndex
CREATE INDEX "pedidos_items_pedido_id_idx" ON "pedidos_items"("pedido_id");

-- CreateIndex
CREATE INDEX "precios_historial_producto_id_idx" ON "precios_historial"("producto_id");

-- CreateIndex
CREATE INDEX "producto_variantes_producto_id_idx" ON "producto_variantes"("producto_id");

-- CreateIndex
CREATE INDEX "productos_categoria_id_idx" ON "productos"("categoria_id");

-- CreateIndex
CREATE INDEX "ventas_cliente_id_idx" ON "ventas"("cliente_id");

-- CreateIndex
CREATE INDEX "ventas_items_producto_id_idx" ON "ventas_items"("producto_id");

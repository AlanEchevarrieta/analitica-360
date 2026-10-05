-- Stock y valorización: sumar movimientos sin leer la tabla (index-only scan).
CREATE INDEX IF NOT EXISTS "movimientos_inventario_stock_idx" ON "movimientos_inventario"("empresa_id", "producto_id", "deleted_at", "cantidad", "signo", "variante_id", "tipo", "referencia_id", "fecha");

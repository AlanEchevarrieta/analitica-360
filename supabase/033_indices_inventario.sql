-- Índices de inventario para historial, filtros por tipo y ubicaciones.
-- SQL Editor, rol postgres. Pegá TODO y dale Run.

CREATE INDEX IF NOT EXISTS idx_movimientos_producto
  ON public.movimientos_inventario (producto_id, empresa_id);

CREATE INDEX IF NOT EXISTS idx_movimientos_tipo
  ON public.movimientos_inventario (empresa_id, tipo);

CREATE INDEX IF NOT EXISTS idx_ubicaciones_empresa
  ON public.ubicaciones (empresa_id);

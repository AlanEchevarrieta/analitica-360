-- Objetivos (facturación, ganancia, producción y despachos) por empresa, sucursal o usuario,
-- y lo que hace falta para medir los pedidos: fecha comprometida e historia de estados.

ALTER TABLE "pedidos" ADD COLUMN "fecha_comprometida" DATE;

CREATE TABLE "pedido_estados" (
    "id" BIGSERIAL NOT NULL,
    "pedido_id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "estado" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pedido_estados_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "pedido_estados_pedido_id_creado_en_idx" ON "pedido_estados"("pedido_id", "creado_en");
CREATE INDEX "pedido_estados_empresa_id_estado_creado_en_idx" ON "pedido_estados"("empresa_id", "estado", "creado_en");
ALTER TABLE "pedido_estados" ADD CONSTRAINT "pedido_estados_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Cada alta y cada cambio de estado queda registrado, venga de donde venga (pantalla, tienda o scripts).
CREATE OR REPLACE FUNCTION pedido_registrar_estado() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.estado IS DISTINCT FROM OLD.estado THEN
    INSERT INTO pedido_estados (pedido_id, empresa_id, estado) VALUES (NEW.id, NEW.empresa_id, NEW.estado);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pedidos_registrar_estado
  AFTER INSERT OR UPDATE OF estado ON pedidos
  FOR EACH ROW EXECUTE FUNCTION pedido_registrar_estado();

-- Historia de los pedidos que ya existían: el alta y, si se despachó, el despacho (fecha de su venta).
INSERT INTO pedido_estados (pedido_id, empresa_id, estado, creado_en)
SELECT p.id, p.empresa_id, 'nuevo', p.created_at FROM pedidos p;
INSERT INTO pedido_estados (pedido_id, empresa_id, estado, creado_en)
SELECT p.id, p.empresa_id, 'despachado', v.fecha FROM pedidos p JOIN ventas v ON v.id = p.venta_id;
INSERT INTO pedido_estados (pedido_id, empresa_id, estado, creado_en)
SELECT p.id, p.empresa_id, p.estado, GREATEST(COALESCE(v.fecha, p.created_at), p.created_at) + interval '1 second'
FROM pedidos p LEFT JOIN ventas v ON v.id = p.venta_id
WHERE p.estado NOT IN ('nuevo', 'despachado');

CREATE TABLE "objetivos" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "periodo" VARCHAR(10) NOT NULL,
    "meta" DECIMAL(16,2) NOT NULL,
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'ARS',
    "ubicacion" TEXT,
    "usuario_id" UUID,
    "producto_id" UUID,
    "creado_por" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "objetivos_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "objetivos_tipo_check" CHECK ("tipo" IN ('facturacion', 'ganancia', 'produccion', 'despachos', 'dias_despacho', 'a_tiempo')),
    CONSTRAINT "objetivos_periodo_check" CHECK ("periodo" IN ('semana', 'mes', 'trimestre', 'anio')),
    CONSTRAINT "objetivos_moneda_check" CHECK ("moneda" IN ('ARS', 'USD')),
    CONSTRAINT "objetivos_meta_check" CHECK ("meta" > 0),
    CONSTRAINT "objetivos_un_alcance_check" CHECK ("ubicacion" IS NULL OR "usuario_id" IS NULL)
);
CREATE INDEX "objetivos_empresa_id_idx" ON "objetivos"("empresa_id");
ALTER TABLE "objetivos" ADD CONSTRAINT "objetivos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "objetivos" ADD CONSTRAINT "objetivos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "objetivos" ADD CONSTRAINT "objetivos_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Presupuestos en dólares, reales o pesos chilenos: cotización diaria y moneda del presupuesto.
CREATE TABLE "cotizaciones_monedas" (
    "moneda" VARCHAR(3) NOT NULL,
    "fecha" DATE NOT NULL,
    "compra" DECIMAL(14,4) NOT NULL,
    "venta" DECIMAL(14,4) NOT NULL,
    CONSTRAINT "cotizaciones_monedas_pkey" PRIMARY KEY ("moneda","fecha")
);

ALTER TABLE "presupuestos" ADD COLUMN "moneda" VARCHAR(3) NOT NULL DEFAULT 'ARS';
ALTER TABLE "presupuestos" ADD COLUMN "cotizacion" DECIMAL(14,4);
ALTER TABLE "presupuestos" ADD COLUMN "cotizacion_de" VARCHAR(80);

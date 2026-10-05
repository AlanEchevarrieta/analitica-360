-- Cotización del dólar por día, para ver los reportes en US$.
CREATE TABLE "cotizaciones_dolar" (
    "casa" VARCHAR(10) NOT NULL,
    "fecha" DATE NOT NULL,
    "compra" DECIMAL(12,2) NOT NULL,
    "venta" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "cotizaciones_dolar_pkey" PRIMARY KEY ("casa","fecha")
);

ALTER TABLE "configuracion_empresa" ADD COLUMN "dolar_tipo" VARCHAR(10) NOT NULL DEFAULT 'blue';

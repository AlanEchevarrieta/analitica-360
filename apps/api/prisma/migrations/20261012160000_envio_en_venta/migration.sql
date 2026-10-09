-- Envío en la caja (opción A, decidida por Alan el 2026-10-09): la venta suma el envío que pagó el cliente.
-- El gasto real del envío se registra en gastos al crear el envío en Zipnova.
-- AlterTable
ALTER TABLE "ventas" ADD COLUMN     "costo_envio" DECIMAL(12,2) NOT NULL DEFAULT 0;


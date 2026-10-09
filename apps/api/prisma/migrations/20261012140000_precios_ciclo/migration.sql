-- Precios de la estrategia del 2026-10-05 (lo que muestra la landing es lo que se cobra).
-- El descuento por ciclo (trimestral −15 %, anual −25 %) está en el código (planes.util).
-- Acá, solo datos: cada cambio se aplica si el dato sigue como lo dejó el sistema (no pisa ediciones del admin).

-- 1) Anual en hasta 6 cuotas sin interés (antes 3).
UPDATE "planes" SET "cuotas_anual" = 6 WHERE "cuotas_anual" = 3;

-- 2) UCIM360: −10 % mensual, −25 % trimestral y −35 % anual durante 24 meses (antes 40/20 % en la entrada).
UPDATE "cupones"
SET "reglas" = '{"mensual": {"cuotas": 1, "entrada": [{"meses": 1, "porcentaje": 10}], "renovacionPct": 10, "periodosEntrada": 1, "renovacionPeriodos": 23}, "trimestral": {"cuotas": null, "entrada": [{"meses": 3, "porcentaje": 25}], "renovacionPct": 25, "periodosEntrada": 1, "renovacionPeriodos": 7}, "anual": {"cuotas": null, "entrada": [{"meses": 12, "porcentaje": 35}], "renovacionPct": 35, "periodosEntrada": 1, "renovacionPeriodos": 1}}'::jsonb
WHERE "codigo" = 'UCIM360'
  AND "reglas" = '{"anual": {"cuotas": 3, "entrada": [{"meses": 3, "porcentaje": 40}, {"meses": 9, "porcentaje": 20}], "renovacionPct": 20, "periodosEntrada": 1, "renovacionPeriodos": null}, "mensual": {"cuotas": 1, "entrada": [], "renovacionPct": 0, "periodosEntrada": 1, "renovacionPeriodos": null}, "trimestral": {"cuotas": 3, "entrada": [{"meses": 3, "porcentaje": 40}], "renovacionPct": 0, "periodosEntrada": 1, "renovacionPeriodos": null}}'::jsonb;

-- 3) Códigos de referido: el nuevo paga 10 % menos que cualquier cliente en su primer período
--    (mensual 10 %, trimestral 15 + 10 = 25 %, anual 25 + 10 = 35 %).
UPDATE "cupones"
SET "reglas" = '{"mensual": {"cuotas": null, "entrada": [{"meses": 1, "porcentaje": 10}], "renovacionPct": 0, "periodosEntrada": 1, "renovacionPeriodos": 0}, "trimestral": {"cuotas": null, "entrada": [{"meses": 3, "porcentaje": 25}], "renovacionPct": 0, "periodosEntrada": 1, "renovacionPeriodos": 0}, "anual": {"cuotas": null, "entrada": [{"meses": 12, "porcentaje": 35}], "renovacionPct": 0, "periodosEntrada": 1, "renovacionPeriodos": 0}}'::jsonb
WHERE "tipo" = 'referido'
  AND "reglas" = '{"anual": {"cuotas": null, "entrada": [{"meses": 12, "porcentaje": 10}], "renovacionPct": 0, "periodosEntrada": 1, "renovacionPeriodos": 0}, "mensual": {"cuotas": null, "entrada": [{"meses": 1, "porcentaje": 10}], "renovacionPct": 0, "periodosEntrada": 1, "renovacionPeriodos": 0}, "trimestral": {"cuotas": null, "entrada": [{"meses": 3, "porcentaje": 10}], "renovacionPct": 0, "periodosEntrada": 1, "renovacionPeriodos": 0}}'::jsonb;

-- Planes nuevos: 6 cuotas en el anual por defecto.
ALTER TABLE "planes" ALTER COLUMN "cuotas_anual" SET DEFAULT 6;

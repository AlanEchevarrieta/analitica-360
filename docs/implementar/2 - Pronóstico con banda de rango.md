---
tags: [analitica360, para-implementar]
estado: para hacer
creado: 2026-11-03
---
# Pronóstico con banda de rango
Volver a [[Para implementar]]

> Basado en `main` de GitHub (`9384b29`). **Claude no tocó código.**

## Qué se quiere y por qué
- El 30/10 se le sumó al pronóstico de Insights una línea "Pronosticado", un punto "En curso" y 3 recuadros de texto (commit `480447a`, que está en `main`). **A Alan no le gustó:** demasiadas líneas y demasiado texto.
- **Decidió (2026-11-03):** volver al gráfico original, con solo Real y Proyección, y sumarle una **franja sombreada con el rango probable**. Arriba, una sola frase: "Próximas 4 semanas: entre $X y $Y". Abajo, "Precisión: …" en una línea.

**Cómo se vería:**
```
Pronóstico de ventas 📈 en alza
Próximas 4 semanas: entre $3,1 M y $6,2 M

 $2M ┤            ░░░░░░░░
     │  ╭─╮  ╭╮ ░░░╌╌╌╌╌░░
 $1M ┤─╯  ╰─╯╰─╌╌╌░░░░░░░░
     └──────────┼──────────
      ago  sep  hoy   nov
 ── Real   ╌╌ Proyección   ░░ Rango probable
Precisión: poco confiable (±45 %)
```

> **Ojo (revisado el 2026-11-03):** en `main`, el hermano ya le cambió las etiquetas a la tarjeta ("Real cerrado", "Pronóstico retrospectivo", "Proyección futura" y "En curso (hoy)") y la calificación. Este documento la reemplaza igual: quedan solo Real y Proyección, más la banda.

## Cómo se calcula la banda
- La API ya mide cuánto le viene errando el pronóstico: `medirPrecision` en `apps/api/src/modules/analytics/insights.util.ts`, que calcula `precision.errorPromedio` (en plata por período) y `precision.errorPct`. **Eso se deja.**
- **En cada período proyectado:**
  - `rangoMin = max(0, proyeccion − errorPromedio)`;
  - `rangoMax = proyeccion + errorPromedio`.
- **Total de la frase:** "entre" la suma de los `rangoMin` y la suma de los `rangoMax`.
- **Sin precisión** (menos de 5 períodos cerrados): no hay banda. La frase queda como antes ("Proyección próximas 4 semanas: $X") y abajo dice "Todavía no hay historia suficiente para medir la precisión".
- **Calificación** (ya existe en `PronosticoCard.tsx`, función `calificar`): menos de 15 % "bastante certero", menos de 30 % "orientativo", y si no, "poco confiable".

## Qué archivos tocar
1. **`apps/api/src/modules/analytics/insights.util.ts`:**
   - En `PuntoForecast`, sacar `pronosticado` y `realEnCurso`, y agregar `rango: [number, number] | null`. Solo se llena en los períodos proyectados.
   - En `armarForecast`:
     - sigue calculando la prueba hacia atrás, pero solo para `medirPrecision`, sin ponerla en `puntos`;
     - llena `rango` en los proyectados con `precision.errorPromedio`;
     - en el último período real, `rango = [total, total]`, para que la banda arranque pegada a la línea;
     - saca `enCurso` y agrega `totalRango: { min, max } | null`.
2. **`insights.util.spec.ts`:**
   - ajustar las 2 pruebas del 30/10;
   - nueva prueba: con error promedio 400, una proyección de 1000 da `rango = [600, 1400]`;
   - nueva prueba: el mínimo nunca baja de 0.
3. **`apps/web/src/features/analytics/types/index.ts`:** el mismo cambio en `InsightForecast`.
4. **`apps/web/src/features/analytics/components/PronosticoCard.tsx`:**
   - sacar las líneas `pronosticado` y `realEnCurso`, el `ReferenceLine` "Hoy" y el componente `PrecisionPronostico` con sus 3 recuadros;
   - sumar la banda: `<Area dataKey="rango" fill="var(--color-proyeccion)" fillOpacity={0.15} stroke="none" />`. Recharts dibuja una franja cuando el valor es un par `[min, max]`. Pasar el `LineChart` a `ComposedChart`;
   - `CardDescription`: "Próximas 4 semanas: entre $X y $Y", o el texto de antes si no hay rango;
   - debajo del gráfico, una línea `text-xs text-muted-foreground`: "Precisión: <calificación> (±<errorPct> %)";
   - tooltip de los períodos proyectados: "Proyección $X · entre $A y $B".

## Pasos en orden
1. API y pruebas.
2. Tipos y tarjeta de la web.
3. Revisar en la compu con los datos de Acacia, en Semanal y Mensual, en computadora y en celular (390 px).

## Cómo probar
- **Semanal con Acacia:** la banda es ancha (le erra alrededor del 45 %) y dice "poco confiable".
- **Mensual con Acacia:** sin banda (hay 4 meses cerrados) y con el aviso de que falta historia.
- **En US$:** la banda se convierte igual que la proyección.
- **En celular:** el gráfico y las dos frases entran sin desbordar.

## Hecho por el hermano
- Fecha:
- Commit:
- Qué cambió respecto del plan:

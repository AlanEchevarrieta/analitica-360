---
tags: [analitica360, para-implementar, auditoria]
estado: para hacer
creado: 2026-11-03
---
# Gastos recurrentes: auditoría del 2026-11-03
Volver a [[Para implementar]]

> Revisado por Claude leyendo `main` de GitHub (commit `9384b29`, 1/11). **Claude no tocó código.**

## Qué vio Alan
En Analytics → Contabilidad cargó el alquiler del stand: **$50.000 por semana**. Cuando quiso que contara también en los otros meses, el gráfico de arriba ("Últimos 6 meses y proyección") no muestra lo que esperaba.

## Cómo funciona hoy
- **Un gasto recurrente se carga una sola vez** y se repite solo desde su fecha hacia adelante. `expandirRecurrentes` en `apps/api/src/modules/contabilidad/contabilidad.util.ts` lo repite cada 7 días, 15 días o 1 mes.
- **No tiene fecha de fin** y **no se puede editar.** Solo se puede cambiar si es fijo o variable (`PATCH /gastos/:id/tipo-costo`) o anularlo (`POST /gastos/:id/anular`).
- **El gráfico de arriba** (`ContabilidadVista.tsx`, `serie6` + `proyeccion`) suma por mes todas las veces que el gasto cae en ese mes.

## Lo que encontré (de más grave a menos)

### 1. 🔴 Anular un gasto recurrente borra toda su historia, no solo lo que viene
- **Qué pasa:** `anular` (en `prisma-gasto.repository.ts`) le pone `deletedAt`, y `listar` filtra `deletedAt: null`. El gasto desaparece **de todos los meses**, también de los que ya pasaron.
- **Por qué confunde:** la web pregunta "¿Anular…? **Deja de repetirse**" (`GastosPanel.tsx`, línea ~129). Eso hace pensar que solo deja de contar desde hoy.
- **Ejemplo:** si sube el alquiler y Alan anula el de $50.000 para cargar uno nuevo, septiembre y octubre quedan sin alquiler. El resultado de esos meses sale inflado.

### 2. 🔴 Para que cuente en meses anteriores hay que cargarlo de nuevo, y queda duplicado
- **Qué pasa:** el recurrente cuenta desde su fecha de carga. Si se cargó el 1/9, junio, julio y agosto quedan sin alquiler.
- **Por qué se duplica:** como no se puede editar la fecha de inicio, la única forma es cargar otro con fecha anterior. Pero el primero sigue vigente, y desde su fecha cuentan **los dos**: $100.000 por semana.
- **Es lo más probable** en lo que vio Alan. Para confirmarlo hay que mirar la lista de gastos de Acacia en producción.
- **En la base de la compu de Alan** se ven intentos así: tres "Stand Garibaldi y San Martín" de $50.000 semanales, dos ya anulados.

### 3. 🟡 Semanal no es "4 por mes": hay meses de 4 semanas y meses de 5
- Con inicio el martes 1/9: septiembre tiene 5 martes ($250.000), octubre y noviembre 4 ($200.000) y diciembre 5 ($250.000).
- La cuenta está bien, pero el gráfico no lo explica y parece que "no respeta" los $50.000.

### 4. 🟡 Con la vista en US$ el monto cambia todas las semanas
- Cada gasto se pasa a dólares con la cotización de su día (`conv.a(g.monto, g.fecha)`). Los mismos $50.000 dan un valor distinto cada semana, y los meses proyectados usan el dólar de hoy.
- La captura de Alan del 30/10 tenía **US$** prendido. El gráfico no avisa que los gastos se cargaron en pesos.

### 5. ⚪ El mes en curso está a medias
- En los 6 meses "reales", el mes actual solo cuenta hasta hoy. El 3/11 noviembre muestra 1 semana de alquiler, mientras que los meses proyectados muestran el mes entero. Se ve un pozo en el mes actual.

## Qué cambiar

### A. Fecha de fin y "dejar de repetir" (arregla el 1)
1. **Base:** columna `fecha_fin` (date, nullable) en `gastos`, con su migración de Prisma y el campo `fechaFin` en el schema.
2. **API:**
   - `expandirRecurrentes` no repite después de `fechaFin`;
   - endpoint nuevo `POST /gastos/:id/dejar-de-repetir` con `{ desde: AAAA-MM-DD }`, que guarda `fechaFin = desde − 1 día`;
   - `anular` queda solo para gastos mal cargados.
3. **Web (`GastosPanel.tsx`):** en los recurrentes, dos botones:
   - **"Dejar de repetir"**, que pide la fecha y por defecto pone hoy;
   - **"Anular (lo cargué mal)"**, con el aviso: "Se borra de todos los meses, también de los anteriores".
4. **`gastos-recurrentes.ts` (`vecesEnPeriodo`):** que respete `fechaFin`, igual que la API.

### B. Editar un recurrente (arregla el 2)
1. **`PATCH /gastos/:id`** para corregir descripción, categoría, monto y **fecha de inicio** (es para errores de carga: cambia toda la historia).
2. **"Cambiar el monto desde…"** (para aumentos), que hace dos cosas en una transacción:
   - le pone `fechaFin` al viejo (el día anterior);
   - crea uno nuevo con el monto nuevo desde esa fecha.
   La historia queda bien: hasta octubre $50.000 y desde noviembre el monto nuevo.
3. **Aviso de duplicado al crear:** si ya hay un recurrente vigente de la misma categoría y el mismo monto que se superpone, avisar: "Ya tenés «Stand Garibaldi…» semanal desde el 1/9. ¿Querés cambiarle la fecha de inicio en vez de cargar otro?".

### C. Que el gráfico explique los números (arregla el 3, el 4 y el 5)
1. **Tooltip de la barra de gastos:** el detalle de los recurrentes. Por ejemplo: "Alquiler: 5 semanas × $50.000 = $250.000". La API puede devolver `recurrentesDetallePorMes`.
2. **Con US$ prendido,** una línea debajo del gráfico: "Los gastos cargados en pesos se pasan a dólares con el dólar de cada día".
3. **Mes actual:** etiqueta "(en curso)", como ya se hace con "(proy.)".

## Pasos en orden
1. Mirar en producción los gastos de Acacia: buscar recurrentes duplicados o superpuestos y, si los hay, corregirlos con Alan.
2. A (fecha de fin), con su migración y pruebas.
3. B (editar, cambiar monto y aviso de duplicado).
4. C (tooltip, aviso de US$ y "en curso").

## Cómo probar
- **Pruebas en `contabilidad.util.spec.ts`:**
  - semanal desde el 1/9: septiembre 5 veces y octubre 4;
  - con `fechaFin` el 31/10: noviembre 0 y octubre igual que antes;
  - "cambiar monto desde el 1/11": octubre con el monto viejo y noviembre con el nuevo, sin superposición;
  - "dejar de repetir" no cambia los meses anteriores.
- **En la app, con Acacia:**
  - un solo alquiler semanal de $50.000 desde el 1/6;
  - en $, junio a octubre muestran 4 o 5 × $50.000 en el tooltip;
  - después de "dejar de repetir" desde el 1/12, septiembre sigue con su alquiler.
- **En US$:** aparece el aviso y el tooltip muestra el monto en pesos que se cargó.

## Hecho por el hermano
- Fecha:
- Commit:
- Qué cambió respecto del plan:

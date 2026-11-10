---
tags: [analitica360, para-implementar, diseño]
estado: para hacer
creado: 2026-11-03
---
# Tarjetas de 2 por fila en el celular
Volver a [[Para implementar]]

> Basado en `main` de GitHub (`9384b29`). **Claude no tocó código.**

## Qué se quiere y por qué
- En el celular, las tarjetas de números (ventas, ganancia, resultado…) ocupan **todo el ancho, una por fila**. Hay que bajar mucho para ver 4 números.
- **Decidió Alan (2026-11-03):** **2 tarjetas por fila**, más compactas. Se descartaron 3 por fila: en un celular de 390 px los montos grandes como $12.345.678 no entran sin abreviarlos.

**Cómo se vería (390 px):**
```
┌──────────┐┌──────────┐
│Ventas    ││Ganancia  │
│$1.234.567││$456.789  │
│+12 % ▲   ││38 % marg.│
└──────────┘└──────────┘
┌──────────┐┌──────────┐
│Resultado ││Equilibrio│
│$210.000  ││$890.000  │
│● 17 %    ││faltan 3d │
└──────────┘└──────────┘
```

## Lo que hay hoy
- **Inicio ya está en 2 por fila:** `grid grid-cols-2 … lg:grid-cols-4` en `apps/web/src/features/dashboard/components/InicioDashboard.tsx`. Sirve de modelo.
- **En Analytics, las grillas usan `sm:grid-cols-2`:** debajo de 640 px (cualquier celular) queda 1 por fila. Son estas:
  - `apps/web/src/features/analytics/components/ContabilidadVista.tsx`, línea ~48;
  - `apps/web/src/features/analytics/components/EstadosContablesVista.tsx`, línea ~248;
  - `apps/web/src/features/analytics/components/GananciaProductos.tsx`, línea ~60;
  - `apps/web/src/features/analytics/components/VentasPeriodo.tsx`, línea ~126.
- **La tarjeta** es `Kpi`, en `apps/web/src/features/analytics/components/comunes.tsx`. Usa monto `text-2xl` y debajo un detalle sin límite de largo; hay detalles de dos renglones, como "Margen neto 17 % · Rinde 23 % sobre costo + gastos".

## Qué cambiar
1. **Grillas:** en las 4 de arriba, cambiar `grid gap-4 sm:grid-cols-2 lg:grid-cols-4` por `grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4`, igual que en Inicio.
2. **`Kpi` (`comunes.tsx`), más compacta en el celu:**
   - la tarjeta ocupa toda la altura de la fila (`h-full`), así las dos de una fila quedan iguales;
   - monto: `text-lg sm:text-2xl`, con `truncate` y `min-w-0` para que nunca desborde;
   - título: `text-xs sm:text-sm`, en una línea (`truncate`);
   - detalle: `line-clamp-2 sm:line-clamp-none`, con el texto completo en `title` para verlo al mantener apretado;
   - el semáforo (el puntito de color) se queda.
3. **No forzar el cuadrado perfecto** (`aspect-square`): con textos de distinto largo se cortan o quedan huecos. Con 2 columnas y la misma altura ya se ven como cuadrados.
4. **Detalles más cortos en Contabilidad:** acortar los que pasan de una línea. Por ejemplo, "Margen neto 17 % · Rinde 23 %" en vez de "… sobre costo + gastos". Lo largo puede ir en el `title`.
5. **Revisar además** `ContabilidadVista.tsx` línea ~95 (`sm:grid-cols-3`) y `EquilibrioInicio.tsx` línea ~114. Si son tarjetas de números, pasarlas a `grid-cols-2`.

## Cómo probar
- En el celular (390 px) o con el modo celular del navegador: Inicio, Contabilidad, Estados contables, Ganancia por producto y Ventas muestran **2 tarjetas por fila**, sin texto cortado a la mitad ni desbordes horizontales.
- **Monto largo** (en una empresa de prueba, ventas por $12.345.678): entra en la tarjeta.
- **En computadora:** sigue en 4 por fila, igual que hoy.
- **Modo oscuro y claro:** se ven bien los dos.

## Hecho por el hermano
- Fecha:
- Commit:
- Qué cambió respecto del plan:

---
title: "Manual de Uso: Control de Inventario, Kardex y Lotes"
type: manual-usuario
tags:
  - manual/usuario
  - modulo/inventario
  - modulo/stock
  - caso-de-uso
created: 2026-10-26
updated: 2026-10-26
author: Antigravity Assistant
status: publicado
version: "1.0"
aliases:
  - "Inventario"
  - "Stock"
  - "Kardex"
  - "Lotes y Vencimientos"
  - "CU-012"
---

# 📦 Manual de Uso: Control de Inventario, Kardex y Lotes

> [!info] Objetivo de la Funcionalidad
> El módulo de **Inventario** garantiza el control estricto de las existencias físicas de tu empresa: consulta de stock multidepósito o sucursales, transferencias entre depósitos, registro de mermas y roturas, control de lotes con fechas de vencimiento y auditoría mediante **Kardex histórico valorizado**.

> [!abstract] Requisitos Previos y Permisos
> - **Rol de Usuario Requerido:** `Dueño` o `Colaborador` con permiso asignado sobre `Inventario`.
> - Negocio con actividades de productos físicos (`productos` o `produccion`).

---

## 🗺️ Diagrama del Flujo de Movimientos y Kardex

```mermaid
graph TD
    A[Inventario Actual] --> B{Tipo de Movimiento}
    B -->|Venta Mostrador / Web| C[Salida Automática (- unidades)]
    B -->|Recepción de Compra| D[Ingreso Automático (+ unidades)]
    B -->|Traslado de Sucursal| E[Transferencia: Egreso Dep. Origen -> Ingreso Dep. Destino]
    B -->|Conteo Físico / Auditoría| F[Ajuste de Stock: Seteo del valor real]
    B -->|Rotura / Vencimiento| G[Baja de Stock por Merma con Motivo]

    C --> H[Registro Inmutable en el Kardex]
    D --> H
    E --> H
    F --> H
    G --> H
    H --> I[Recálculo de Saldo y Costo Promedio Ponderado]
```

---

## 📍 Flujo de Navegación

1. En el menú lateral izquierdo, sección **Stock y compras**, hacé clic en **"Inventario"**.
2. Encontrarás tres pestañas clave:
   - **Stock Actual:** Existencias por producto y sucursal con alertas de reposición.
   - **Movimientos:** Historial reciente de ingresos, egresos y traslados.
   - **Kardex:** Ficha cronológica exhaustiva por artículo.

---

## 📋 Guía Visual de Campos e Interacciones

| Control / Campo | Tipo | Obligatorio | Utilidad y Reglas |
| :--- | :--- | :---: | :--- |
| **Selector de Ubicación** | Desplegable | Sí | Filtra por local comercial, depósito central, taller o stand de feria. |
| **Buscador de Stock** | Texto predictivo | No | Filtrá rápidamente por nombre, SKU o código de barras. |
| **Botón "Nuevo Movimiento"**| Acción modal | N/A | Permite registrar ingresos manuales, egresos directos o ajustes de conteo. |
| **Botón "Transferir Stock"**| Acción modal | N/A | Mueve mercadería de un depósito origen a un depósito destino. |
| **Alerta de Stock Crítico** | Indicador rojo | Automático | Se dispara si el stock actual es menor o igual al stock mínimo configurado. |
| **Lote y Vencimiento** | Fecha / Texto | Opcional | Trazabilidad de partidas perecederas con días restantes de vigencia. |

---

## 🔄 Paso a Paso: Ejecución de Casos de Uso

### Caso 1: Registrar una Transferencia entre Depósitos o Locales

1. En **Inventario**, presioná el botón **"Transferir Stock"**.
2. Seleccioná el **Depósito Origen** (ej: *"Depósito Central"*) y el **Depósito Destino** (ej: *"Local Calle Mitre"*).
3. Buscá el producto y la variante requerida.
4. Ingresá la cantidad física a trasladar (ej: `25` unidades).
5. Podés escribir un motivo o número de remito interno de traslado.
6. Presioná **"Confirmar Transferencia"**:
   - En una única transacción atómica, el sistema descontará 25 unidades de origen y las sumará al destino sin margen de error.

### Caso 2: Auditoría y Ajuste de Stock por Conteo Físico

1. Si al contar físicamente las estanterías encontrás una diferencia (ej. el sistema dice 12 unidades pero hay 10):
   - Hacé clic en el botón de opciones `...` junto al producto y elegí **"Ajustar Stock"**.
2. Indicá la ubicación donde se realizó el conteo.
3. Escribí el número real contado (ej: `10`).
4. Seleccioná el motivo: *"Diferencia de inventario / conteo físico"*.
5. Al confirmar, el sistema registrará un movimiento de ajuste de `-2 unidades` en el Kardex asociándolo a tu usuario para auditoría.

### Caso 3: Consulta del Kardex Histórico de un Producto

1. Ingresá a la pestaña **"Kardex"**.
2. Seleccioná el producto que deseás auditar (ej: *"Aceite 10W40 1L"*).
3. Verás una tabla cronológica con:
   - Fecha y hora exacta.
   - Tipo de operación (Venta N° X, Compra N° Y, Ajuste, Baja).
   - Cantidad que entró o salió.
   - Saldo final acumulado resultante.
   - Usuario responsable del movimiento.

---

## ⚠️ Solución de Problemas y Errores Frecuentes

> [!faq] Consultas Frecuentes sobre Stock

| Situación en Pantalla | Causa Probable | Solución Sugerida |
| :--- | :--- | :--- |
| **"Stock en negativo"** | Se realizaron ventas cuando el conteo del sistema no estaba actualizado. | Realizá un ajuste de stock ingresando las compras previas pendientes de carga en `[[13 - Compras a Proveedores y Recepción de Mercadería]]`. |
| **"No puedo transferir: stock insuficiente en origen"** | La sucursal de origen no cuenta con la cantidad solicitada. | Verificá que seleccionaste el depósito de origen correcto en el selector. |

---

## 🔗 Manuales y Documentos Relacionados

- `[[00 - Índice General y Guía de Navegación]]`
- `[[03 - Dashboard de Inicio y Métricas en Tiempo Real]]`
- `[[05 - Punto de Venta (POS), Cobros y Facturación ARCA]]`
- `[[11 - Catálogo de Productos, Servicios y Variantes]]`
- `[[13 - Compras a Proveedores y Recepción de Mercadería]]`

---

<details>
<summary>🔍 <b>Ficha Técnica y Trazabilidad (Para Equipos de Soporte y QA)</b></summary>

### 🖥️ Frontend (Interfaz de Usuario)
- **Componentes:** `apps/web/src/features/inventario/components/StockListado.tsx`, `MovimientosVista.tsx`, `KardexVista.tsx`
- **Ruta de Navegación (URL):** `/inventario`, `/inventario/kardex`, `/inventario/movimientos`

### ⚙️ Backend (Servicio y API)
- **Controlador Movimientos:** `MovimientosController` en `apps/api/src/modules/inventario/movimientos.controller.ts`
- **Controlador Lotes:** `LotesController` en `apps/api/src/modules/inventario/lotes.controller.ts`
- **Controlador Bajas:** `BajasController` en `apps/api/src/modules/bajas/bajas.controller.ts`
- **Endpoints:**
  - `GET /inventario/stock` (Stock consolidado por ubicación).
  - `POST /inventario/movimientos` (Creación de movimiento: ajuste, egreso, ingreso).
  - `POST /inventario/transferir` (Transferencia entre ubicaciones con validación atómica de existencias).
  - `GET /inventario/kardex/:productoId` (Extracción de movimientos históricos ordenados cronológicamente).
- **DTOs:** `CrearMovimientoDto`, `TransferirStockDto`

</details>

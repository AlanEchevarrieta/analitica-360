---
title: "Manual de Uso: Compras a Proveedores y Recepción de Mercadería"
type: manual-usuario
tags:
  - manual/usuario
  - modulo/compras
  - modulo/proveedores
  - modulo/stock
  - caso-de-uso
created: 2026-10-26
updated: 2026-10-26
author: Antigravity Assistant
status: publicado
version: "1.0"
aliases:
  - "Compras"
  - "Recepción de Mercadería"
  - "Facturas de Proveedor"
  - "OCR Facturas"
  - "CU-013"
---

# 🚚 Manual de Uso: Compras a Proveedores y Recepción de Mercadería

> [!info] Objetivo de la Funcionalidad
> El módulo de **Compras** registra el ingreso de mercadería adquirida a proveedores, actualiza automáticamente las existencias de stock, recalcula los costos reales de adquisición (incluyendo fletes y gastos adicionales prorrateados), y ofrece **escaneo OCR inteligente con IA** para cargar facturas a partir de una foto o archivo PDF.

> [!abstract] Requisitos Previos y Permisos
> - **Rol de Usuario Requerido:** `Dueño` o `Colaborador` con permiso asignado sobre `Compras`.
> - Negocio con actividades de venta de productos físicos o fabricación (`productos` o `produccion`).

---

## 🗺️ Diagrama del Flujo de Compras y Costeo Real

```mermaid
graph TD
    A[Recepción de Mercadería y Factura del Proveedor] --> B{Método de Carga}
    B -->|Opción Rápida: Foto / PDF| C[Escaneo Inteligente OCR con IA: Detección Automática de Datos]
    B -->|Opción Manual| D[Completar Formulario de Nueva Compra]
    C --> D
    D --> E[Ingreso de Productos, Cantidades y Costos Unitarios]
    E --> F[Carga de Gastos Adicionales: Flete, Seguro, Descarga]
    F --> G[Prorrateo Automático de Gastos sobre el Costo Unitario]
    G --> H[Selección de Medio de Pago: Contado o Cuenta Corriente Proveedor]
    H --> I[Confirmar Compra]
    I --> J[Impacto en Stock (+ unidades en depósito elegido)]
    I --> K[Actualización de Costos y Sugerencia de Nuevos Precios de Venta]
```

---

## 📍 Flujo de Navegación

1. En el menú lateral izquierdo, sección **Stock y compras**, hacé clic en **"Compras"**.
2. Verás el listado cronológico de comprobantes de compras cargados.
3. Para registrar un ingreso de mercadería, presioná el botón **"+ Nueva Compra"**.

---

## 📋 Guía Visual de Campos e Interacciones

### 1. Cabecera del Comprobante de Compra

| Campo / Control | Tipo | Obligatorio | Descripción / Regla |
| :--- | :--- | :---: | :--- |
| **Proveedor** | Predictivo | Sí | Nombre o razón social del distribuidor (`[[14 - Directorio de Proveedores y Cuentas Corrientes]]`). |
| **Tipo de Comprobante** | Selector | Sí | `Factura A`, `Factura B`, `Factura C`, `Remito de Compra`. |
| **Punto de Venta y Número** | Texto | Sí | Numeración oficial de la factura (ej: `0001-00048192`). |
| **Fecha de Emisión** | Fecha | Sí | Día de facturación para control impositivo y de IVA. |
| **Depósito de Destino** | Selector | Sí | Sucursal o almacén donde se guarda físicamente la mercadería. |
| **Forma de Pago** | Selector | Sí | `Contado (Efectivo/Transferencia)` o `A pagar (Cuenta Corriente)`. |

### 2. Gastos Adicionales y Prorrateo

| Campo / Control | Tipo | Descripción y Beneficio |
| :--- | :--- | :--- |
| **Flete y Transporte ($)** | Moneda | Costo de envío abonado a la empresa de transporte. |
| **Seguro / Embalaje ($)** | Moneda | Gastos extras incurridos para que la mercadería llegue a tu local. |
| **Cálculo de Costo Real** | Automático | El sistema distribuye el flete entre todos los productos de la factura para que tu margen de ganancia real nunca quede distorsionado. |

---

## 🔄 Paso a Paso: Ejecución de Casos de Uso

### Caso 1: Carga Rápida con Escáner OCR de Facturas

1. En **Nueva Compra**, hacé clic en el botón superior **"Escanear Factura con IA"**.
2. Subí el archivo PDF o una foto tomada con tu celular de la factura del proveedor.
3. El motor de inteligencia artificial procesará el documento en segundos:
   - Extraerá el CUIT del emisor, fecha, número de factura y el listado de productos con sus cantidades y precios.
4. Revisá los renglones cargados, confirmá el depósito donde ingresa y presioná **"Guardar Compra"**.

### Caso 2: Carga Manual con Prorrateo de Flete

1. Ingresá a **"+ Nueva Compra"**.
2. Seleccioná al proveedor (ej: *"Distribuidora Mayorista Cuyo"*).
3. Agregá los productos recibidos:
   - *Producto A:* 100 unidades a `$1.000` c/u = `$100.000`.
   - *Producto B:* 50 unidades a `$2.000` c/u = `$100.000`.
   - Subtotal mercadería: `$200.000`.
4. En la sección **Costos Adicionales**, ingresá:
   - *Flete:* `$20.000`.
5. > [!tip] Prorrateo Inteligente
   - El sistema calculará que el flete representa un `10%` adicional sobre la compra. El costo unitario real quedará asentado en `$1.100` para el Producto A y `$2.200` para el Producto B.
6. Presioná **"Confirmar Compra"**:
   - Las unidades ingresarán inmediatamente a tu inventario (`[[12 - Control de Inventario, Kardex y Lotes]]`).
   - Si tenías activada la actualización de precios, tus precios de venta se ajustarán para mantener tu margen de ganancia habitual (`[[11 - Catálogo de Productos, Servicios y Variantes]]`).

---

## ⚠️ Solución de Problemas y Errores Frecuentes

> [!faq] Consultas Frecuentes sobre Compras

| Error / Duda | Causa Probable | Solución Sugerida |
| :--- | :--- | :--- |
| **"El producto recibido no existe en mi catálogo"** | Es la primera vez que comprás este artículo al proveedor. | Podés hacer clic en "+ Crear producto al vuelo" directamente dentro de la pantalla de compra. |
| **"El OCR no reconoció los renglones"** | La foto está borrosa o la factura manuscrita tiene letra ilegible. | Podés corregir o completar manualmente los renglones en la tabla antes de guardar. |

---

## 🔗 Manuales y Documentos Relacionados

- `[[00 - Índice General y Guía de Navegación]]`
- `[[11 - Catálogo de Productos, Servicios y Variantes]]`
- `[[12 - Control de Inventario, Kardex y Lotes]]`
- `[[14 - Directorio de Proveedores y Cuentas Corrientes]]`
- `[[16 - Analytics Comercial, Rentabilidad y Monotributo]]`

---

<details>
<summary>🔍 <b>Ficha Técnica y Trazabilidad (Para Equipos de Soporte y QA)</b></summary>

### 🖥️ Frontend (Interfaz de Usuario)
- **Componentes:** `apps/web/src/features/compras/components/NuevaCompraForm.tsx`, `CostosAdicionales.tsx`, `ComprasListado.tsx`
- **Ruta de Navegación (URL):** `/compras`, `/compras/nueva`, `/compras/:id`

### ⚙️ Backend (Servicio y API)
- **Controlador Compras:** `ComprasController` en `apps/api/src/modules/compras/compras.controller.ts`
- **Controlador Órdenes:** `OrdenesCompraController` en `apps/api/src/modules/compras/ordenes-compra.controller.ts`
- **Endpoints:**
  - `GET /compras` (Listado y filtros por proveedor y período).
  - `POST /compras` (Alta de compra con incremento de stock en depósito y actualización de costos).
  - `POST /compras/ocr` (Procesamiento inteligente de comprobantes con Gemini Flash).
- **DTOs:** `CrearCompraDto`, `ProcesarOcrDto`

</details>

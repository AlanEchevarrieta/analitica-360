---
title: "Manual de Uso: Emisión de Tickets Térmicos y Comprobantes Digitales por WhatsApp"
type: manual-usuario
tags:
  - manual/usuario
  - modulo/ventas
  - modulo/pos
  - modulo/documentos
  - modulo/impresion
  - caso-de-uso
created: 2026-10-31
updated: 2026-10-31
author: Antigravity Assistant
status: publicado
version: "1.0"
aliases:
  - "Ticket Digital"
  - "Ticket Térmico 80mm"
  - "Comprobante WhatsApp"
  - "Modal Post Venta"
  - "CU-030"
---

# 🧾 Manual de Uso: Emisión de Tickets Térmicos y Comprobantes Digitales por WhatsApp

> [!info] Objetivo de la Funcionalidad
> La funcionalidad de **Tickets Térmicos y Comprobantes Digitales** permite al comerciante entregar al cliente su comprobante de compra en **menos de 3 segundos** al finalizar la venta en el Punto de Venta (POS):
> 1. **Modal Post-Venta Inmediato (`ModalTicketPostVenta`):** Se dispara de forma automática apenas se confirma la venta, sin recargar la página ni navegar a otra sección.
> 2. **Impresión Térmica Comandera (80mm y 58mm):** Formato ticket monocromático con tipografía monoespaciada, logo del negocio, desglose de ítems, descuentos, medios de pago y código QR dinámico.
> 3. **Envío 1-Click por WhatsApp:** Genera el mensaje oficial con el detalle de la compra y un enlace público seguro para que el cliente consulte su ticket en su celular.
> 4. **Visor Web Público (`/ticket/[token]`):** Página optimizada para móviles donde el cliente puede ver su ticket interactivo o descargar el PDF formal sin necesidad de tener usuario ni contraseña en la plataforma.

> [!abstract] Requisitos Previos y Permisos
> - **Permisos requeridos:** Rol `Dueño` o `Colaborador` con acceso al módulo de `Ventas`.
> - **Impresora comandera (Opcional):** Cualquier impresora térmica USB, Wi-Fi o Bluetooth compatible con hojas de 80mm o 58mm (Epson TM-T20, Hasar, Xprinter, etc.). El sistema ajusta los márgenes automáticamente vía CSS.
> - **Teléfono del Cliente:** Si el cliente fue seleccionado en el autocompletado, su teléfono se toma automáticamente. Si es un cliente ocasional de mostrador, el modal permite escribir el número al instante antes de enviar.

---

## 🗺️ Diagrama del Flujo de Emisión y Despacho del Ticket

```mermaid
graph TD
    V[Cajero confirma venta en /ventas/nueva] --> POST[API registra venta y genera token HMAC]
    POST --> MODAL[Se abre automáticamente ModalTicketPostVenta]
    
    MODAL --> IMP[Botón 'Imprimir Ticket 80mm']
    IMP --> PRINT[Navegador dispara window.print]
    PRINT --> COMANDERA[Impresora Térmica emite tira con QR]
    
    MODAL --> WPP[Botón 'Enviar por WhatsApp']
    WPP --> API_WPP[Abre wa.me con mensaje prearmado y link]
    API_WPP --> CEL[Cliente recibe link en su WhatsApp]
    
    COMANDERA -.->|Cliente escanea QR| LINK_PUB
    CEL -.->|Cliente toca link| LINK_PUB[/ticket/:token - Visor Público Mobile]
    
    LINK_PUB --> PDF[Opción: Descargar PDF A4 oficial]
    LINK_PUB --> LOCAL[Guardar o imprimir desde el celular]
    
    MODAL --> NUEVA[Tecla Esc o Botón 'Nueva Venta' -> Mostrador listo para siguiente cliente]
```

---

## 📍 Flujos de Operación en el Mostrador

### Flujo 1: Cobro y Entrega Inmediata (Operación de Mostrador)
1. Ingrese a **Ventas** > **Nueva Venta** (`/ventas/nueva`).
2. Agregue los productos al carrito con el lector de código de barras o buscador predictivo.
3. Elija el medio de pago (Efectivo, Mercado Pago, Débito, etc.).
4. Presione **Confirmar Venta**.
5. **Aparición automática del Comprobante:**
   - La pantalla bloquea el fondo y presenta el modal con la vista preliminar en formato térmico.
6. **Opciones rápidas:**
   - **Imprimir en Comandera:** Presione `Enter` o haga clic en **Imprimir Ticket (80mm)**. El navegador abre el diálogo de impresión configurado para 80mm sin cabeceras ni pie de página del navegador.
   - **Enviar por WhatsApp:** Si el cliente ya tenía teléfono cargado, un solo clic abre WhatsApp con el mensaje redactado; si no, escriba el número de WhatsApp en el campo correspondiente (ej. `2615551234`) y presione **Enviar por WhatsApp**.
7. **Siguiente cliente:** Presione la tecla `Escape` o el botón **Nueva Venta**. El carrito se vacía y el cursor vuelve al buscador de productos.

---

### Flujo 2: Experiencia del Cliente (Visor Digital)
Cuando el cliente abre el enlace enviado por WhatsApp (`https://analitica360.app/ticket/TOKEN_SEGURO`) o escanea el código QR del ticket físico:
1. Accede a una pantalla responsiva limpia con el logo y nombre del comercio emisor.
2. Observa el desglose completo:
   - Número de comprobante interno y fecha/hora exacta.
   - Datos fiscales del comercio (CUIT, dirección, teléfono).
   - Tabla de artículos, unidades y subtotales.
   - Descuentos aplicados y medios de pago utilizados.
   - Total final destacado.
3. **Descarga de PDF:** Dispone de un botón destacado **Descargar PDF Completo** si necesita archivar el comprobante oficial.
4. **Seguridad y Privacidad:** El enlace está firmado criptográficamente con algoritmo HMAC-SHA256 y vence a los 60 días de emitido, impidiendo la adulteración del identificador de venta.

---

## ⚙️ Especificaciones Técnicas y Componentes

| Capa | Archivo / Componente | Responsabilidad |
| :--- | :--- | :--- |
| **Frontend POS** | [`ModalTicketPostVenta.tsx`](file:///home/deibon/deibon/analitica-360/apps/web/src/features/ventas/components/ModalTicketPostVenta.tsx) | Ventana modal de alta velocidad que captura el cierre de venta y provee atajos de teclado (`Esc`). |
| **Frontend Impresión** | [`TicketTermico.tsx`](file:///home/deibon/deibon/analitica-360/apps/web/src/features/ventas/components/TicketTermico.tsx) | Componente atómico puro (<160 líneas) con diseño monoespaciado y renderizado del QR dinámico. |
| **Frontend Estilos** | [`globals.css`](file:///home/deibon/deibon/analitica-360/apps/web/src/app/globals.css) | Regla `@media print` que aísla la clase `.ticket-imprimible` a un ancho exacto de `80mm auto` ocultando el resto de la interfaz. |
| **Frontend Público** | [`/ticket/[id]/page.tsx`](file:///home/deibon/deibon/analitica-360/apps/web/src/app/ticket/[id]/page.tsx) | Server Component público con metadata `noindex, nofollow` protegido por token. |
| **Acceso Público** | [`proxy.ts`](file:///home/deibon/deibon/analitica-360/apps/web/src/proxy.ts) | Excepción de ruta pública en el middleware de Clerk para `/ticket(.*)`. |
| **Backend Datos** | `DocumentosService.ticket()` | Agrupa datos del negocio, ítems, totales, genera token HMAC y construye mensaje WhatsApp. |
| **Backend Endpoint** | `GET /documentos/ticket/:tipo/:id` | Provee el JSON para el modal del POS autenticado con sesión del comercio. |
| **Backend Público** | `GET /documentos/ticket/ver/:token` | Endpoint `@Public()` que valida la firma del token antes de entregar los datos. |

---

## 💡 Preguntas Frecuentes

### ¿Necesito una impresora fiscal homologada para usar esta función?
No. Este ticket funciona como **comprobante digital o ticket de control interno de mostrador**. Si tu comercio emite Facturas Electrónicas autorizadas por ARCA (con CAE), el ticket incluirá el número de comprobante fiscal correspondiente y el cliente podrá descargar el PDF con validez tributaria desde el botón de descarga.

### ¿Se pueden personalizar los datos que salen al pie del ticket?
Sí. Desde **Configuración** > **General**, podés cargar un mensaje de agradecimiento personalizado (ej. *"Cambios dentro de los 30 días con este ticket. ¡Gracias por elegirnos!"*), el cual se imprime automáticamente al pie de todos los comprobantes físicos y digitales.

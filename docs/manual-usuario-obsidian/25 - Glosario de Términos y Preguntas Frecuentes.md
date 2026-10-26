---
title: "Manual de Usuario: Glosario de Términos y Preguntas Frecuentes"
type: manual-usuario
tags:
  - manual/usuario
  - glosario
  - faq
  - ayuda
created: 2026-10-26
updated: 2026-10-26
author: Antigravity Assistant
status: publicado
version: "1.0"
aliases:
  - "Glosario"
  - "Preguntas Frecuentes"
  - "FAQ"
  - "Definiciones"
---

# 📖 Glosario de Términos y Preguntas Frecuentes

> [!info] Diccionario y Centro de Respuestas Rápidas
> Esta guía reúne las definiciones de los términos comerciales, impositivos y técnicos utilizados a lo largo de **Analítica 360**, junto con respuestas a las dudas más habituales sobre impresoras, lectores de código de barras y compatibilidad con dispositivos móviles.

---

## 📚 Glosario de Términos Clave

### 🛒 Ventas, Inventario y Logística

#### SKU (Stock Keeping Unit)
- Código alfanumérico interno único con el que tu comercio identifica a cada producto o variante en el depósito (ej: `REM-NEG-XL`). Permite diferenciar rápidamente artículos similares.
- Relacionado: `[[11 - Catálogo de Productos, Servicios y Variantes]]`.

#### EAN-13 / Código de Barras
- Estándar internacional numérico de 13 dígitos que figura en los envases de los productos comerciales. Analítica 360 permite escanearlo con cualquier lector láser o cámara de celular.
- Relacionado: `[[05 - Punto de Venta (POS), Cobros y Facturación ARCA]]`.

#### Kardex
- Registro cronológico inmutable de todas las entradas, salidas y ajustes de un producto en el depósito. Muestra qué se movió, a qué hora, qué usuario lo hizo y cuál fue el saldo resultante.
- Relacionado: `[[12 - Control de Inventario, Kardex y Lotes]]`.

#### BOM (Bill of Materials / Receta Maestra)
- Lista exhaustiva de materias primas, insumos y tiempos de mano de obra necesarios para elaborar una unidad de producto terminado.
- Relacionado: `[[15 - Producción, Fórmulas y Recetas de Fabricación]]`.

#### Picking
- Proceso operativo en el depósito donde un operario recorre las estanterías reuniendo los artículos solicitados en una compra o pedido antes de embalarlos y despacharlos.
- Relacionado: `[[07 - Gestión de Pedidos, Picking y Despachos]]`.

#### Remito
- Documento legal que ampara el traslado físico de mercadería desde el depósito hasta el cliente o entre sucursales. Puede emitirse valorizado (con precios) o sin valorizar (solo cantidades y bultos).
- Relacionado: `[[07 - Gestión de Pedidos, Picking y Despachos]]`.

---

### 🏛️ Facturación y Aspectos Tributarios

#### ARCA (ex-AFIP)
- **Agencia de Recaudación y Control Aduanero** (autoridad tributaria de la República Argentina). Es el organismo ante el cual el sistema tramita y autoriza las Facturas Electrónicas y Notas de Crédito.
- Relacionado: `[[21 - Configuración General, Datos Fiscales y Parámetros]]`.

#### CAE (Código de Autorización Electrónico)
- Número de 14 dígitos otorgado por ARCA que valida legalmente una factura electrónica. Sin CAE, un comprobante no tiene validez fiscal.
- Relacionado: `[[05 - Punto de Venta (POS), Cobros y Facturación ARCA]]`.

#### Facturas A, B y C
- **Factura A:** Se emite cuando el vendedor es Responsable Inscripto y el comprador también es Responsable Inscripto (discrimina IVA).
- **Factura B:** Se emite cuando el vendedor es Responsable Inscripto y el comprador es Consumidor Final, Monotributista o Exento.
- **Factura C:** La emiten exclusivamente los comerciantes adheridos al régimen de Monotributo.
- Relacionado: `[[05 - Punto de Venta (POS), Cobros y Facturación ARCA]]`.

#### Nota de Crédito (NC)
- Comprobante fiscal emitido ante ARCA para anular total o parcialmente una factura emitida previamente (por ejemplo, en caso de devolución de mercadería).
- Relacionado: `[[05 - Punto de Venta (POS), Cobros y Facturación ARCA]]`.

---

### 📊 Gestión, Finanzas y Estrategia

#### Matriz BCG (Boston Consulting Group)
- Cuadrante analítico que clasifica los productos según su rotación de venta y su margen de rentabilidad:
  - ⭐ **Estrellas:** Alta rotación y alto margen (los productos más valiosos).
  - 🐄 **Vacas Lecheras:** Alta rotación pero margen moderado (generan liquidez diaria).
  - ❓ **Interrogantes:** Alto margen pero baja venta (oportunidades para promocionar).
  - 🦴 **Huesos / Perros:** Baja rotación y bajo margen (candidatos a liquidar o descontinuar).
- Relacionado: `[[16 - Analytics Comercial, Rentabilidad y Monotributo]]`.

#### Margen Bruto vs. Margen Neto
- **Margen Bruto:** Diferencia entre el precio de venta y el costo directo de compra del producto.
- **Margen Neto:** Lo que realmente le queda al comerciante una vez deducidos los fletes, impuestos, alquileres, sueldos y costos operativos generales.
- Relacionado: `[[16 - Analytics Comercial, Rentabilidad y Monotributo]]`.

#### Copilot IA (Analítica IA)
- Motor de inteligencia artificial integrado en Analítica 360, entrenado exclusivamente con contexto de gestión comercial y operacional para diagnósticos estratégicos y proyecciones de negocio.
- Relacionado: `[[04 - Copilot IA - Asistente Estratégico de Negocio]]`.

---

## ❓ Preguntas Frecuentes Transversales (FAQ)

> [!faq] ¿Qué tipo de impresoras de tickets son compatibles?
> Analítica 360 es compatible con cualquier impresora térmica estándar del mercado conectada por USB, red Ethernet, Wi-Fi o Bluetooth:
> - **Impresoras de 80 mm:** Formato estándar de supermercados y grandes comercios (Epson TM-T20, Hasar, Xprinter, Bematech).
> - **Impresoras de 58 mm:** Formato compacto o portátil de bolsillo.
> - **Impresoras tradicionales A4:** Formato hoja completa para remitos y facturas A con membrete oficial.

> [!faq] ¿Qué lectores de código de barras puedo utilizar?
> Cualquier lector de código de barras USB o Bluetooth con emulación de teclado (*keyboard wedge*) funciona sin necesidad de instalar drivers especiales:
> - Lectores de mano láser o 2D (lee pantallas de celulares y códigos QR).
> - Lectores omnidireccionales de mostrador.
> - La cámara de tu teléfono móvil o tablet desde la app web.

> [!faq] ¿Puedo usar el sistema en mi celular o tablet?
> Sí. Toda la interfaz de Analítica 360 está diseñada con tecnología responsive moderna. Podés ingresar desde Chrome o Safari en tu teléfono Android o iPhone, crear un acceso directo en tu pantalla de inicio y utilizar el Punto de Venta, la Agenda de turnos o el Picking como si fuera una aplicación nativa.

> [!faq] ¿Mis datos están seguros ante cortes de luz o rotura de computadora?
> Totalmente. Analítica 360 almacena tu información en servidores en la nube con copias de seguridad automáticas diarias y cifrado de grado bancario. Si tu computadora sufre un desperfecto o se corta la energía, podés abrir el navegador en cualquier otra máquina o celular y continuar vendiendo exactamente donde habías quedado.

---

## 🔗 Navegación Rápida a la Bóveda

- 🏠 **[[00 - Índice General y Guía de Navegación]]**
- 🚀 **[[01 - Primeros Pasos, Registro y Acceso]]**
- 🛒 **[[05 - Punto de Venta (POS), Cobros y Facturación ARCA]]**
- 📦 **[[11 - Catálogo de Productos, Servicios y Variantes]]**
- 📊 **[[16 - Analytics Comercial, Rentabilidad y Monotributo]]**
- 🎫 **[[23 - Mesa de Ayuda y Soporte Técnico]]**

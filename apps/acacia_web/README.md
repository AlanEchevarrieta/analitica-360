# Acacia Mates Web (Storefront Independiente)

Frontend de e-commerce exclusivo para **Acacia Mates** (Mendoza, Argentina), diseñado bajo la estética y filosofía de **Snow Peak** (*Wabi-Sabi*, minimalismo japonés, layouts asimétricos editoriales, fotografía lifestyle inmersiva y manufactura táctil noble) e integrado con la API pública de **Analítica 360**.

---

## 🏔️ Principios de Diseño (`acacia-ui`)

- **Grillas Asimétricas & Anti-Grid:** Rompe las cuadrículas genéricas de tarjetas de e-commerce con proporciones editoriales 60/40 y 70/30.
- **Paleta Wabi-Sabi & Outdoors:** Lienzo crudo (`#F7F6F2`), piedra mineral (`#E5E5E1`), pizarra carbón (`#1C1D1F`), olivo profundo (`#2B302A`) y acento en brasas (`#D9532F`) y alpaca (`#C5A059`).
- **Jerarquía Tipográfica Refinada:** Serif amplio (*Cormorant Garamond*) + Sans equilibrado (*Inter*) + Ficha técnica en monospace (*Space Mono*).
- **El Ritual del Mate:** Presentación del objeto en su hábitat natural (campamento, amanecer, fuego), con bitácora de curado de 72 horas y especificaciones técnicas de materiales nobles.
- **Transiciones Ponderadas:** Movimientos lentos y precisos con sticky scroll donde la fotografía permanece anclada mientras la narrativa y detalles se deslizan suavemente.

---

## 🔌 Integración con Analítica 360

El storefront consume los endpoints públicos de la API de Analítica 360 (`apps/api`, NestJS en puerto 3001):
- `GET /tienda-sitio/:empresaId`: Metadatos, colores e identidad de Acacia Mates.
- `GET /tienda/:empresaId/catalogo`: Catálogo completo de mates, bombillas y marroquinería en tiempo real.
- `POST /tienda/:empresaId/pedidos`: Creación directa de pedidos en el ERP/CRM con origen `tienda_online`.
- `POST /tienda/:empresaId/pedidos/:pedidoId/pago`: Checkout con Mercado Pago.

---

## 🚀 Puesta en Marcha

### Requisitos
- Node.js >= 20
- pnpm o npm

### Instalación y Ejecución Local
```bash
# Instalar dependencias
pnpm install

# Modo desarrollo (puerto 3020)
pnpm dev

# Compilar para producción
pnpm build
pnpm start
```

### Variables de Entorno (`.env.local`)
```env
ANALITICA_API_URL=http://localhost:3001
ACACIA_EMPRESA_ID=47d60e49-bf3b-4ca4-915f-3269c5fdbcf9
```

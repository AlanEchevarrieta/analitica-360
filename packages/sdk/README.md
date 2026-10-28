# @analitica360/sdk 🚀

SDK oficial y Widget embeddable de **Analítica 360** para integrar reservas de turnos online, catálogo de productos, cupones, cotizaciones de envío y checkout de pedidos en cualquier aplicación web, e-commerce, SPA o sitio existente (WordPress, Wix, Webflow, Shopify, etc.).

---

## 📦 Instalación

### Opción A: Vía NPM / PNPM (para proyectos React, Next.js, Vue, Vite, etc.)

```bash
npm install @analitica360/sdk
# o con pnpm
pnpm add @analitica360/sdk
```

### Opción B: Vía CDN / Script directo (para WordPress, Wix o HTML simple)

No requiere instalar nada ni compilar código. Solo agregá esta línea antes del cierre de `</body>`:

```html
<script 
  src="https://cdn.analitica360.app/widget.js" 
  data-empresa="TU_UUID_DE_EMPRESA"
  data-color="#059669"
  data-position="bottom-right"
  data-button-text="Reservar Turno"
></script>
```

---

## 🎯 3 Modos de Integración

### Modo 1: Widget Embebido de Turnos (Cero Código)

Ideal para centros de estética, spas, peluquerías, consultorios o servicios profesionales que ya tienen su propia web y quieren que sus clientes reserven online directamente al CRM de Analítica 360.

```html
<!-- Inyección con Script Tag -->
<script 
  src="https://cdn.analitica360.app/widget.js" 
  data-empresa="123e4567-e89b-12d3-a456-426614174000"
  data-color="#059669"
  data-position="bottom-right"
></script>
```

O si preferís montarlo programáticamente desde JavaScript/TypeScript:

```typescript
import { initTurnosWidget } from '@analitica360/sdk/widget';

const widget = initTurnosWidget({
  empresaId: '123e4567-e89b-12d3-a456-426614174000',
  themeColor: '#059669',
  buttonText: 'Agendá tu Cita',
  onSuccess: (reserva) => {
    console.log('Turno confirmado:', reserva.id, reserva.cuando);
  }
});

// Podés abrirlo o cerrarlo cuando quieras:
// widget.open();
// widget.close();
```

---

### Modo 2: Cliente Headless para SPAs (React, Next.js, Vue, Astro)

Si diseñaste una SPA o frontend a medida y querés el control total de la interfaz:

```typescript
import { Analitica360Client } from '@analitica360/sdk';

const crm = new Analitica360Client({
  empresaId: '123e4567-e89b-12d3-a456-426614174000',
  // baseUrl: 'https://api.analitica360.app' // opcional
});

// 1. Obtener servicios y profesionales disponibles
const opciones = await crm.turnos.opciones();
if (opciones.activa) {
  console.log('Servicios:', opciones.servicios);
  console.log('Profesionales:', opciones.profesionales);
}

// 2. Consultar horarios libres en una fecha
const libres = await crm.turnos.libres({
  fecha: '2026-10-30',
  servicioId: 'id-servicio-masaje'
});
console.log('Horarios libres:', libres.libres.map(h => h.hora));

// 3. Confirmar la reserva online
const reserva = await crm.turnos.reservar({
  servicioId: 'id-servicio-masaje',
  fecha: '2026-10-30',
  hora: '16:00',
  nombre: 'Luciana Fernández',
  telefono: '2615551234',
  notas: 'Primera sesión'
});

console.log('Reserva exitosa:', reserva.cuando, 'con', reserva.profesional);
```

---

### Modo 3: E-Commerce y Pedidos Online

Integrá el catálogo de productos y el checkout de pedidos en tu tienda web:

```typescript
import { Analitica360Client } from '@analitica360/sdk';

const crm = new Analitica360Client({
  empresaId: '123e4567-e89b-12d3-a456-426614174000'
});

// 1. Listar productos vendibles (con precios vigentes y stock)
const productos = await crm.catalogo.listar();

// 2. Validar cupón de descuento
const cupon = await crm.cupones.validar('PROMO10', 50000);
if (cupon.valido) {
  console.log('Descuento a aplicar:', cupon.descuento.montoDescontado);
}

// 3. Crear pedido desde la web
const pedido = await crm.pedidos.crear({
  clienteNombre: 'Martín Gomez',
  clienteEmail: 'martin@ejemplo.com',
  clienteTelefono: '2614443322',
  direccionEnvio: 'San Martín 1234',
  codigoPostal: '5500',
  localidad: 'Mendoza',
  provincia: 'Mendoza',
  formaPago: 'mercadopago',
  items: [
    { productoId: 'uuid-producto', cantidad: 2 }
  ]
});

// 4. Redirigir a Mercado Pago si pagó con tarjeta
if (pedido.pagoUrl) {
  window.location.href = pedido.pagoUrl;
}
```

---

## 🛡️ Manejo de Errores

El SDK arroja instancias tipadas de `Analitica360Error`:

```typescript
import { Analitica360Error } from '@analitica360/sdk';

try {
  await crm.turnos.reservar({ ... });
} catch (error) {
  if (error instanceof Analitica360Error) {
    console.error(`Error HTTP ${error.status}: ${error.message} (Código: ${error.code})`);
    if (error.issues) {
      console.error('Detalle de validación:', error.issues);
    }
  }
}
```

---

## 📄 Licencia

MIT © Analítica 360

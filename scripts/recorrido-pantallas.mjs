// Recorrido automático de todas las pantallas de apps/web (Playwright).
// Entra con un sign-in token de Clerk (instancia de desarrollo), abre cada
// ruta, junta errores de página/consola y requests fallidos a la API, y saca
// una captura de cada pantalla.
//
// Uso (web en :3000 y API en :3001 levantadas):
//   node scripts/recorrido-pantallas.mjs <clerkUserId> <carpetaCapturas> [ancho]
// RUTAS=/inicio,/ventas limita el recorrido a esas rutas.
// CLIC="Mes pasado" toca ese texto en cada pantalla antes de la captura.
// PALETA=acacia y MODO=light|dark eligen la apariencia (cookie y localStorage).
// MONEDA=USD muestra el Inicio y Analytics en dólares (botón $ / US$).

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const [clerkUserId, carpeta, ancho = '1440'] = process.argv.slice(2);
if (!clerkUserId || !carpeta) {
  console.error('Uso: node scripts/recorrido-pantallas.mjs <clerkUserId> <carpetaCapturas> [ancho]');
  process.exit(1);
}
const WEB = process.env.WEB_URL ?? 'http://localhost:3000';
const API = process.env.API_URL ?? 'http://localhost:3001';
const env = Object.fromEntries(
  fs.readFileSync(new URL('../apps/api/.env', import.meta.url), 'utf8')
    .split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]),
);
const clerk = (p, body) =>
  fetch(`https://api.clerk.com/v1${p}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  }).then((r) => r.json());

// IDs reales para las pantallas de detalle (se toman de la API con la sesión del navegador).
const RUTAS_FIJAS = [
  '/inicio', '/ventas', '/ventas/nueva', '/ventas/devoluciones', '/productos', '/productos/nuevo', '/inventario', '/inventario/movimientos',
  '/compras', '/compras/nueva', '/pedidos', '/pedidos/nuevo', '/clientes', '/clientes/segmentos', '/clientes/nuevo',
  '/proveedores', '/proveedores/nuevo', '/analytics/ventas', '/analytics/productos', '/analytics/contabilidad',
  '/analytics/insights', '/analytics/estados', '/configuracion', '/planes', '/soporte', '/soporte/nuevo', '/admin', '/admin/clientes', '/admin/pagos', '/admin/alianzas', '/admin/alianzas/cupones', '/admin/uso', '/admin/auditoria', '/admin/soporte', '/admin/sistema',
];

fs.mkdirSync(carpeta, { recursive: true });
const { token } = await clerk('/sign_in_tokens', { user_id: clerkUserId, expires_in_seconds: 600 });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: Number(ancho), height: 900 }, locale: 'es-AR' });
if (process.env.PALETA) await context.addCookies([{ name: 'a360-paleta', value: process.env.PALETA, url: WEB }]);
if (process.env.MODO) await context.addInitScript((modo) => localStorage.setItem('theme', modo), process.env.MODO);
if (process.env.MONEDA) await context.addInitScript((m) => localStorage.setItem('a360-moneda', m), process.env.MONEDA);
const page = await context.newPage();

const problemas = [];
let rutaActual = 'login';
page.on('pageerror', (e) => problemas.push({ ruta: rutaActual, tipo: 'error de página', detalle: e.message.slice(0, 300) }));
page.on('console', (m) => {
  if (m.type() === 'error' && !/Clerk: Clerk has been loaded with development keys|Download the React DevTools/.test(m.text())) {
    problemas.push({ ruta: rutaActual, tipo: 'consola', detalle: m.text().slice(0, 300) });
  }
});
page.on('response', (r) => {
  if (r.url().startsWith(API) && r.status() >= 400) problemas.push({ ruta: rutaActual, tipo: `API ${r.status()}`, detalle: r.url().replace(API, '') });
});

// Login con ticket y elegir empresa si hace falta.
await page.goto(`${WEB}/sign-in?__clerk_ticket=${token}`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
await page.waitForURL((u) => !u.pathname.startsWith('/sign-in'), { timeout: 180_000 });
if (page.url().includes('/elegir-empresa')) {
  await page.getByText('Acacia', { exact: false }).first().click();
  await page.waitForURL((u) => !u.pathname.startsWith('/elegir-empresa'), { timeout: 120_000 });
}

// IDs para rutas de detalle, usando el token de la sesión del navegador.
const ids = await page.evaluate(async (api) => {
  const token = await window.Clerk.session.getToken();
  const get = (p) => fetch(`${api}${p}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
  const [ventas, productos, pedidos, proveedores, clientes, camaras] = await Promise.all([
    get('/ventas?pagina=1&pageSize=1'), get('/productos?pagina=1&pageSize=50&orden=demanda'), get('/pedidos?pagina=1&pageSize=1'),
    get('/proveedores?pagina=1&pageSize=1'), get('/clientes'),
    // Solo el admin ve cámaras (a los demás la API les responde 403 y quedaría como problema).
    get('/admin/yo').then((r) => (r?.admin ? get('/admin/alianzas/camaras') : [])).catch(() => []),
  ]);
  return {
    venta: ventas.items?.[0]?.id,
    producto: (productos.items ?? []).find((p) => p.nombre === 'Bolso Matero')?.id ?? productos.items?.[0]?.id,
    pedido: pedidos.items?.[0]?.id,
    proveedor: proveedores.items?.[0]?.id,
    cliente: clientes?.[0]?.id,
    camara: Array.isArray(camaras) ? camaras[0]?.id : undefined,
  };
}, API);
const conocidas = [
  ...RUTAS_FIJAS,
  ids.venta && `/ventas/${ids.venta}`,
  ids.producto && `/productos/${ids.producto}`,
  ids.pedido && `/pedidos/${ids.pedido}`,
  ids.pedido && `/pedidos/${ids.pedido}/remito`,
  ids.proveedor && `/proveedores/${ids.proveedor}`,
  ids.cliente && `/clientes/${ids.cliente}`,
  ids.camara && `/admin/alianzas/${ids.camara}`,
].filter(Boolean);
// Con RUTAS se recorren esas, en ese orden (también rutas que no están en la lista).
const rutas = process.env.RUTAS ? process.env.RUTAS.split(',') : conocidas;

const resumen = [];
for (const ruta of rutas) {
  rutaActual = ruta;
  const t0 = Date.now();
  try {
    await page.goto(`${WEB}${ruta}`, { waitUntil: 'domcontentloaded', timeout: 240_000 });
    // Esperar a que terminen las cargas (skeletons con aria-busy) y los fetch.
    await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => {});
    await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 60_000 }).catch(() => {});
    await page.waitForTimeout(Number(process.env.ESPERA_MS ?? 800));
    // CLIC="Mes pasado" toca ese texto antes de la captura (p. ej. para elegir un período con datos).
    if (process.env.CLIC) {
      await page.getByText(process.env.CLIC, { exact: true }).first().click().catch(() => {});
      await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
      await page.waitForTimeout(800);
    }
    // Next agrega un role="alert" vacío (anunciador de rutas): solo cuentan los que tienen texto.
    const alerta = (await page.locator('[role="alert"]').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
    if (alerta.length) problemas.push({ ruta, tipo: 'mensaje de error en pantalla', detalle: alerta.join(' | ').slice(0, 300) });
    // En el celular, nada tiene que obligar a deslizar de costado.
    const ancho_doc = await page.evaluate(() => document.documentElement.scrollWidth);
    if (ancho_doc > Number(ancho) + 1) problemas.push({ ruta, tipo: 'desborde horizontal', detalle: `${ancho_doc}px en una pantalla de ${ancho}px` });
    const archivo = `${ruta.replace(/^\//, '').replace(/[/[\]?=&:*"<>|]/g, '_') || 'raiz'}.png`;
    // Captura de toda la página: se agranda la ventana y se espera a que los
    // gráficos se redibujen (con fullPage la foto salía al empezar la animación).
    const alto = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: Number(ancho), height: Math.min(alto, 12000) });
    await page.waitForTimeout(1800);
    await page.screenshot({ path: path.join(carpeta, archivo) });
    await page.setViewportSize({ width: Number(ancho), height: 900 });
    resumen.push({ ruta, ms: Date.now() - t0, archivo });
  } catch (e) {
    problemas.push({ ruta, tipo: 'no cargó', detalle: String(e.message ?? e).slice(0, 300) });
  }
}

await browser.close();
fs.writeFileSync(path.join(carpeta, 'resultado.json'), JSON.stringify({ resumen, problemas }, null, 2));
console.log(`Pantallas: ${resumen.length}/${rutas.length} · Problemas: ${problemas.length}`);
for (const p of problemas) console.log(`  [${p.tipo}] ${p.ruta}: ${p.detalle}`);

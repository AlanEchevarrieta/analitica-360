// Mide cuánto tarda en quedar lista cada pantalla y cuánto descarga (versión de producción).
// Uso: WEB_URL=http://localhost:3005 node scripts/medir-pantallas.mjs <clerkUserId> [ancho]
import fs from 'node:fs';
import { chromium } from '@playwright/test';

const [usuario, ancho = '1440'] = process.argv.slice(2);
const WEB = process.env.WEB_URL ?? 'http://localhost:3005';
const env = Object.fromEntries(
  fs.readFileSync(new URL('../apps/api/.env', import.meta.url), 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]),
);
const RUTAS = ['/inicio', '/ventas', '/ventas/nueva', '/productos', '/inventario', '/compras/nueva', '/pedidos', '/clientes', '/analytics/ventas', '/analytics/productos', '/analytics/contabilidad', '/analytics/estados', '/analytics/insights', '/configuracion', '/planes'];

const { token } = await fetch('https://api.clerk.com/v1/sign_in_tokens', {
  method: 'POST', headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ user_id: usuario, expires_in_seconds: 600 }),
}).then((r) => r.json());
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: Number(ancho), height: 900 } });
const page = await ctx.newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(e.message.slice(0, 160)));
await page.goto(`${WEB}/sign-in?__clerk_ticket=${token}`);
await page.waitForURL((u) => !u.pathname.startsWith('/sign-in'), { timeout: 120_000 });

const filas = [];
for (const ruta of RUTAS) {
  const t0 = Date.now();
  await page.goto(`${WEB}${ruta}`, { waitUntil: 'domcontentloaded' });
  const html = Date.now() - t0;
  await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"], [data-slot="skeleton"]'), null, { timeout: 30_000 }).catch(() => {});
  const lista = Date.now() - t0;
  const kb = await page.evaluate(() => Math.round(performance.getEntriesByType('resource').filter((r) => r.initiatorType === 'script').reduce((a, r) => a + (r.transferSize || 0), 0) / 1024));
  filas.push({ ruta, html, lista, jsKb: kb });
}
await browser.close();
console.log('pantalla'.padEnd(26), 'HTML'.padStart(7), 'Lista'.padStart(7), 'JS nuevo'.padStart(9));
for (const f of filas) console.log(f.ruta.padEnd(26), `${f.html}ms`.padStart(7), `${f.lista}ms`.padStart(7), `${f.jsKb}KB`.padStart(9));
console.log('errores:', errores.length ? errores : 'ninguno');

// Recorrido de la tienda modelo (apps/tienda) como lo haría un comprador, con capturas.
// Catálogo, búsqueda, filtros, ficha, carrito, checkout con cupón, ingreso con código y Mi cuenta.
//
// Uso (Docker local: tienda en :3010, API con CODIGOS_INGRESO_EN_LOG=1):
//   node scripts/recorrido-tienda.mjs <carpetaCapturas> [subdominio=acacia] [email] [cupon]
// El código de ingreso se lee del log de la API (docker logs analitica-360-api-1).
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const [carpeta, subArg, emailArg, cupon = ''] = process.argv.slice(2);
const sub = subArg || 'acacia';
const email = emailArg || `recorrido+${Date.now()}@e2e.test`;
if (!carpeta) {
  console.error('Uso: node scripts/recorrido-tienda.mjs <carpetaCapturas> [subdominio] [email] [cupon]');
  process.exit(1);
}
const BASE = process.env.TIENDA_URL ?? `http://${sub}.localhost:3010`;
fs.mkdirSync(carpeta, { recursive: true });

const problemas = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(process.env.ANCHO ?? 1280), height: 900 } });
page.on('pageerror', (e) => problemas.push(`[error de página] ${page.url()}: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && problemas.push(`[consola] ${page.url()}: ${m.text()}`));
page.on('response', (r) => r.status() >= 500 && problemas.push(`[${r.status()}] ${r.url()}`));

const foto = async (nombre) => page.screenshot({ path: path.join(carpeta, `${nombre}.png`), fullPage: true });
const paso = async (nombre, fn) => {
  try {
    await fn();
    console.log(`ok  ${nombre}`);
  } catch (e) {
    problemas.push(`[falló] ${nombre}: ${e.message.split('\n')[0]}`);
    console.log(`MAL ${nombre}`);
    await foto(`error-${nombre}`).catch(() => {});
  }
};

await paso('catalogo', async () => {
  await page.goto(`${BASE}/productos`);
  await page.getByRole('heading', { name: 'Productos' }).waitFor();
  await foto('01-catalogo');
});
await paso('buscador', async () => {
  await page.getByRole('button', { name: 'Buscar' }).click();
  await page.getByRole('combobox', { name: 'Buscar en la tienda' }).fill('mat');
  await page.getByRole('listbox').waitFor({ timeout: 5000 });
  await foto('02-buscador');
  await page.keyboard.press('Enter');
  await page.waitForURL(/q=mat/);
  await foto('03-resultados');
});
await paso('filtros-y-orden', async () => {
  await page.goto(`${BASE}/productos?orden=menor`);
  await page.getByRole('button', { name: /Filtros/ }).click();
  await page.getByLabel('Solo con stock').click();
  await page.waitForURL(/stock=1/);
  await foto('04-filtros');
});
await paso('menu-categorias', async () => {
  await page.goto(`${BASE}/`);
  await page.getByRole('link', { name: 'Productos ▾' }).hover();
  await page.waitForTimeout(300);
  await foto('05-menu-categorias');
});
let ficha = '';
await paso('ficha', async () => {
  await page.goto(`${BASE}/productos?stock=1`);
  ficha = await page.locator('a[href^="/productos/"]').first().getAttribute('href');
  await page.goto(`${BASE}${ficha}`);
  await page.getByRole('button', { name: /Agregar al carrito/ }).first().click();
  await foto('06-ficha');
});
await paso('checkout', async () => {
  await page.goto(`${BASE}/checkout`);
  await page.getByRole('heading', { name: 'Finalizar pedido' }).waitFor();
  if (cupon) {
    await page.getByLabel('Código de descuento').fill(cupon);
    await page.getByRole('button', { name: 'Aplicar' }).click();
    await page.getByText(/aplicado|no|vencido|mínimo/i).first().waitFor({ timeout: 5000 });
  }
  await foto('07-checkout');
});
await paso('favorito-sin-sesion', async () => {
  await page.goto(`${BASE}${ficha}`);
  await page.getByRole('button', { name: /Guardar .* en favoritos/ }).click();
  await page.waitForURL(/ingresar/);
  await foto('08-ingresar');
});
await paso('ingreso-con-codigo', async () => {
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Mandarme el código' }).click();
  await page.getByLabel('Código de 6 números').waitFor();
  await page.waitForTimeout(800);
  const log = execSync('docker logs --since 2m analitica-360-api-1 2>&1', { encoding: 'utf8' });
  const codigo = [...log.matchAll(new RegExp(`Código de ingreso para ${email.replace(/[.+]/g, '\\$&')}: (\\d{6})`, 'g'))].at(-1)?.[1];
  if (!codigo) throw new Error('no apareció el código en el log de la API');
  await page.getByLabel('Código de 6 números').fill(codigo);
  await page.waitForURL((u) => !u.pathname.startsWith('/ingresar'), { timeout: 10000 });
});
await paso('favorito-con-sesion', async () => {
  await page.goto(`${BASE}${ficha}`);
  await page.getByRole('button', { name: /Guardar .* en favoritos/ }).click();
  await page.getByRole('button', { name: /Quitar .* de favoritos/ }).waitFor();
});
await paso('mi-cuenta', async () => {
  await page.goto(`${BASE}/mi-cuenta`);
  await page.getByRole('heading', { name: /Hola/ }).waitFor();
  await foto('09-mi-cuenta');
});

await browser.close();

// Limpieza: la cuenta de prueba (y la clienta que creó) no quedan en los datos del negocio.
if (!emailArg) {
  const sql = `BEGIN;
    DELETE FROM favoritos_tienda WHERE cuenta_id IN (SELECT id FROM cuentas_tienda WHERE email = '${email}');
    DELETE FROM sesiones_tienda WHERE cuenta_id IN (SELECT id FROM cuentas_tienda WHERE email = '${email}');
    DELETE FROM codigos_ingreso_tienda WHERE email = '${email}';
    CREATE TEMP TABLE c AS SELECT cliente_id FROM cuentas_tienda WHERE email = '${email}';
    DELETE FROM cuentas_tienda WHERE email = '${email}';
    DELETE FROM clientes WHERE id IN (SELECT cliente_id FROM c) AND NOT EXISTS (SELECT 1 FROM pedidos p WHERE p.cliente_id = clientes.id);
    COMMIT;`;
  try {
    execSync('docker exec -i analitica-360-postgres-1 psql -q -U analitica360 -d analitica360', { input: sql });
    console.log(`limpieza: se borró la cuenta de prueba ${email}`);
  } catch (e) {
    problemas.push(`[limpieza] no se pudo borrar ${email}: ${e.message.split('\n')[0]}`);
  }
}
console.log(problemas.length ? `\nProblemas (${problemas.length}):\n  ${problemas.join('\n  ')}` : '\nSin problemas.');

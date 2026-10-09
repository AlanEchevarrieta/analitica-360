// El día del pase de una empresa del sistema viejo (Supabase) al nuevo, en un solo comando.
//
// Encadena, en orden y frenando al primer problema:
//   1. copia de seguridad de la base (pg_dump);
//   2. cambios de estructura pendientes (prisma migrate deploy);
//   3. ventas que falten (traer-ventas-legacy);
//   4. compras que falten (traer-compras-legacy);
//   5. correcciones de errores heredados (corregir-datos-legacy);
//   6. SKU de los productos que no tengan;
//   7. controles: el viejo contra el nuevo, venta por venta, compra por compra, stock de cada
//      producto y plata por medio de pago. Una diferencia de stock solo se acepta si la explican
//      exactamente los movimientos que existen solo en el sistema nuevo (correcciones, ventas
//      hechas en el nuevo).
// Al final deja un informe en Markdown y sale con código 1 si algo no cuadra.
//
// Sin --aplicar es un ENSAYO: no escribe nada (pasos 1 a 6 solo dicen qué harían) y corre los controles.
//
// Uso (desde apps/api, con DATABASE_URL, SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY):
//   node scripts/dia-del-pase.mjs --empresa <uuid> [--desde AAAA-MM-DD] [--hasta AAAA-MM-DD] [--aplicar]
//        [--sin-copia] [--informe <archivo.md>]
// --desde por defecto: 3 días antes de la última venta que ya tiene la base nueva (traer no duplica).
// --hasta por defecto: hoy (Argentina).
// --sin-copia: si la copia ya se hizo por otro lado (por ejemplo, el pg_dump del servidor).
// PG_DUMP: ruta de pg_dump si no está en el PATH (ej. "C:/Program Files/PostgreSQL/16/bin/pg_dump.exe").
// En el servidor: docker compose -f docker-compose.prod.yml run --rm -e SUPABASE_URL -e SUPABASE_SERVICE_ROLE_KEY migrate \
//   node scripts/dia-del-pase.mjs --empresa <uuid> [--aplicar]
import 'dotenv/config';
import 'reflect-metadata';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const RAIZ_API = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : null;
};
const APLICAR = process.argv.includes('--aplicar');
const SIN_COPIA = process.argv.includes('--sin-copia');
const EMPRESA = arg('empresa');
const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/+$/, '');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!EMPRESA || !/^[0-9a-f-]{36}$/i.test(EMPRESA) || !SUPABASE_URL || !KEY || !process.env.DATABASE_URL) {
  console.error('Uso: --empresa <uuid> [--desde AAAA-MM-DD] [--hasta AAAA-MM-DD] [--aplicar] [--sin-copia] [--informe <archivo.md>]\n(y DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
  process.exit(2);
}

const hoyAR = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const diaAR = (iso) => new Date(Date.parse(iso) - 3 * 3600_000).toISOString().slice(0, 10);
const sumarDias = (dia, n) => new Date(Date.parse(`${dia}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const pesos = (n) => `$${Math.round(n).toLocaleString('es-AR')}`;
const num = (v) => Number(v ?? 0);

const informe = [];
let problemas = 0;
let avisos = 0;
const linea = (texto = '') => {
  informe.push(texto);
  console.log(texto);
};
const ok = (t) => linea(`- ✅ ${t}`);
const aviso = (t) => {
  avisos++;
  linea(`- ⚠️ ${t}`);
};
const mal = (t) => {
  problemas++;
  linea(`- ❌ ${t}`);
};

async function leerViejo(ruta) {
  const filas = [];
  for (let desde = 0; ; desde += 1000) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Range: `${desde}-${desde + 999}` } });
    if (!r.ok) throw new Error(`Supabase ${ruta.split('?')[0]}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    const lote = await r.json();
    filas.push(...lote);
    if (lote.length < 1000) return filas;
  }
}

/** Corre otro script (o el CLI de Prisma) con el mismo entorno; devuelve su salida. Frena el pase si falla. */
function correr(titulo, comando, args) {
  // Sin shell: rutas con espacios (C:\Program Files) se pasan enteras.
  const r = spawnSync(comando, args, { cwd: RAIZ_API, env: process.env, encoding: 'utf8' });
  const salida = `${r.stdout ?? ''}${r.stderr ?? ''}`
    .split('\n')
    .filter((l) => l.trim() && !/injected env|Loaded Prisma config|Prisma schema loaded|Datasource|Assertion failed: !\(handle->flags/.test(l))
    .join('\n');
  linea(`\n<details><summary>${titulo}</summary>\n\n\`\`\`\n${salida.trim() || '(sin salida)'}\n\`\`\`\n</details>\n`);
  // En Windows, node a veces termina con un "Assertion failed" de libuv después de terminar bien: no cuenta.
  const fallo = r.status !== 0 && !/Assertion failed: !\(handle->flags/.test(r.stderr ?? '');
  if (fallo) {
    mal(`${titulo}: terminó con error (código ${r.status}). El pase se frena acá.`);
    throw new Error('paso fallido');
  }
  return salida;
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const inicio = Date.now();
try {
  const empresa = (await db.query('SELECT nombre FROM empresas WHERE id = $1', [EMPRESA])).rows[0];
  if (!empresa) throw new Error(`La empresa ${EMPRESA} no existe en la base nueva`);
  const ultima = (await db.query(`SELECT max(fecha) AS f FROM ventas WHERE empresa_id = $1`, [EMPRESA])).rows[0].f;
  const HASTA = arg('hasta') ?? hoyAR();
  const DESDE = arg('desde') ?? (ultima ? sumarDias(diaAR(ultima.toISOString()), -3) : '2020-01-01');
  const base = new URL(process.env.DATABASE_URL);

  linea(`# Día del pase: ${empresa.nombre}`);
  linea('');
  linea(`- **Modo:** ${APLICAR ? '**APLICAR** (escribe en la base)' : 'ensayo (no escribe nada)'}`);
  linea(`- **Base:** ${base.hostname}:${base.port || 5432}${base.pathname} · **Fecha:** ${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}`);
  linea(`- **Ventas a traer:** del ${DESDE} al ${HASTA}`);

  // ---- 1. Copia de seguridad ----
  linea('\n## 1. Copia de seguridad');
  if (!APLICAR) ok('Ensayo: no hace falta copia (no se escribe nada).');
  else if (SIN_COPIA) aviso('Se indicó --sin-copia: la copia se hizo por otro lado.');
  else {
    const carpeta = path.resolve(RAIZ_API, '..', '..', 'backups');
    fs.mkdirSync(carpeta, { recursive: true });
    const archivo = path.join(carpeta, `antes-del-pase-${hoyAR()}-${Date.now()}.sql`);
    const r = spawnSync(process.env.PG_DUMP || 'pg_dump', ['--no-owner', '--no-acl', '-f', archivo, process.env.DATABASE_URL], { encoding: 'utf8' });
    if (r.error || r.status !== 0 || !fs.existsSync(archivo) || !fs.readFileSync(archivo, 'utf8').includes('PostgreSQL database dump complete')) {
      mal(`No se pudo hacer la copia con pg_dump (${r.error?.message ?? r.stderr?.trim() ?? 'sin detalle'}). Hacela a mano y volvé a correr con --sin-copia.`);
      throw new Error('sin copia');
    }
    ok(`Copia hecha: ${archivo} (${Math.round(fs.statSync(archivo).size / 1024 / 1024)} MB).`);
  }

  // ---- 2. Cambios de estructura ----
  linea('\n## 2. Cambios de estructura de la base');
  const enCarpeta = fs.readdirSync(path.join(RAIZ_API, 'prisma', 'migrations')).filter((d) => /^\d{14}_/.test(d)).sort();
  const aplicadas = new Set((await db.query('SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')).rows.map((r) => r.migration_name));
  const pendientes = enCarpeta.filter((m) => !aplicadas.has(m));
  if (pendientes.length === 0) ok('No hay cambios pendientes.');
  else if (!APLICAR) aviso(`Faltan aplicar ${pendientes.length}: ${pendientes.join(', ')}. Con --aplicar se aplican.`);
  else {
    const prismaCli = createRequire(path.join(RAIZ_API, 'package.json')).resolve('prisma/build/index.js');
    correr('prisma migrate deploy', process.execPath, [prismaCli, 'migrate', 'deploy']);
    const ahora = new Set((await db.query('SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')).rows.map((r) => r.migration_name));
    const quedan = enCarpeta.filter((m) => !ahora.has(m));
    if (quedan.length) {
      mal(`Siguen sin aplicar: ${quedan.join(', ')}`);
      throw new Error('migraciones');
    }
    ok(`Aplicados ${pendientes.length} cambios: ${pendientes.join(', ')}.`);
  }

  // ---- 3 a 5. Traer lo que falte y corregir lo heredado ----
  const conAplicar = APLICAR ? ['--aplicar'] : [];
  linea('\n## 3. Ventas del sistema viejo');
  const sv = correr('traer-ventas-legacy', process.execPath, ['scripts/traer-ventas-legacy.mjs', '--empresa', EMPRESA, '--desde', DESDE, '--hasta', HASTA, ...conAplicar]);
  linea(`- ${sv.split('\n').find((l) => l.startsWith('Nuevas para copiar')) ?? 'Ver detalle.'}`);
  linea('\n## 4. Compras del sistema viejo');
  const sc = correr('traer-compras-legacy', process.execPath, ['scripts/traer-compras-legacy.mjs', '--empresa', EMPRESA, ...conAplicar]);
  linea(`- ${sc.split('\n').find((l) => l.startsWith('Legacy')) ?? 'Ver detalle.'}`);
  linea('\n## 5. Correcciones de errores heredados');
  correr('corregir-datos-legacy', process.execPath, ['scripts/corregir-datos-legacy.mjs', '--empresa', EMPRESA, ...conAplicar]);
  ok(APLICAR ? 'Correcciones aplicadas (ver detalle).' : 'Ensayo de correcciones (ver detalle).');

  // ---- 6. SKU ----
  linea('\n## 6. Códigos (SKU) de productos');
  const sinSku = num(
    (
      await db.query(
        `SELECT (SELECT count(*) FROM productos WHERE empresa_id = $1 AND deleted_at IS NULL AND sku IS NULL AND usa_variantes = false)
              + (SELECT count(*) FROM producto_variantes WHERE empresa_id = $1 AND deleted_at IS NULL AND sku IS NULL) AS n`,
        [EMPRESA],
      )
    ).rows[0].n,
  );
  if (sinSku === 0) ok('Todos los productos tienen SKU.');
  else if (!APLICAR) aviso(`${sinSku} productos o variantes sin SKU: con --aplicar se generan.`);
  else {
    const dist = path.join(RAIZ_API, 'dist');
    if (!fs.existsSync(path.join(dist, 'modules', 'productos', 'prisma-sku.repository.js'))) {
      mal('No está compilada la API (falta dist/): corré "pnpm exec nest build" y volvé a correr.');
      throw new Error('sin dist');
    }
    const { PrismaService } = await import(new URL(`file:///${path.join(dist, 'database', 'prisma.service.js').replace(/\\/g, '/')}`).href);
    const { PrismaSkuRepository } = await import(new URL(`file:///${path.join(dist, 'modules', 'productos', 'prisma-sku.repository.js').replace(/\\/g, '/')}`).href);
    const prisma = new PrismaService();
    try {
      ok(`SKU generados: ${await new PrismaSkuRepository(prisma).asignarFaltantes(EMPRESA)}.`);
    } finally {
      await prisma.$disconnect();
    }
  }

  // ---- 7. Controles ----
  linea('\n## 7. Controles: sistema viejo contra el nuevo');
  const [vViejo, cViejo, mViejo, pViejo] = await Promise.all([
    leerViejo(`ventas?empresa_id=eq.${EMPRESA}&select=id,fecha,numero_venta,total_con_interes,forma_pago,deleted_at`),
    leerViejo(`compras?empresa_id=eq.${EMPRESA}&select=id,fecha,deleted_at`),
    leerViejo(`movimientos_inventario?empresa_id=eq.${EMPRESA}&select=id,producto_id,variante_id,cantidad,signo,referencia_id,deleted_at`),
    leerViejo(`productos?empresa_id=eq.${EMPRESA}&select=id,nombre`),
  ]);
  const vNuevo = (
    await db.query(
      `SELECT v.id::text, v.fecha, v.numero_venta, v.total_con_interes, v.forma_pago, v.deleted_at, v.descuento, v.coeficiente_interes,
              (SELECT coalesce(sum(i.cantidad * i.precio_unitario), 0) FROM ventas_items i WHERE i.venta_id = v.id) AS items
       FROM ventas v WHERE v.empresa_id = $1`,
      [EMPRESA],
    )
  ).rows;
  const cNuevo = (await db.query('SELECT id::text, deleted_at FROM compras WHERE empresa_id = $1', [EMPRESA])).rows;
  const mNuevo = (await db.query('SELECT id::text, producto_id::text, variante_id::text, cantidad, signo, referencia_id::text, deleted_at FROM movimientos_inventario WHERE empresa_id = $1', [EMPRESA])).rows;
  const nombres = new Map([...pViejo.map((p) => [p.id, p.nombre]), ...(await db.query('SELECT id::text, nombre FROM productos WHERE empresa_id = $1', [EMPRESA])).rows.map((p) => [p.id, p.nombre])]);

  // Ventas, una por una.
  linea('\n### Ventas');
  const idsNuevo = new Map(vNuevo.map((v) => [v.id, v]));
  const idsViejo = new Set(vViejo.map((v) => v.id));
  const faltan = vViejo.filter((v) => !idsNuevo.has(v.id));
  let movidas = [];
  if (faltan.length) {
    const enOtra = (await db.query('SELECT id::text, empresa_id::text FROM ventas WHERE id = ANY($1::uuid[])', [faltan.map((v) => v.id)])).rows;
    movidas = enOtra.filter((r) => r.empresa_id !== EMPRESA).map((r) => r.id);
  }
  const perdidas = faltan.filter((v) => !movidas.includes(v.id));
  linea(`- Viejo: ${vViejo.length} ventas · nuevo: ${vNuevo.length}.`);
  if (perdidas.length) mal(`Faltan ${perdidas.length} ventas del viejo en el nuevo: ${perdidas.slice(0, 15).map((v) => `${v.numero_venta} (${diaAR(v.fecha)})`).join(', ')}${perdidas.length > 15 ? '…' : ''}`);
  else ok('No falta ninguna venta del sistema viejo.');
  if (movidas.length) ok(`${movidas.length} ventas del viejo están en otra empresa a propósito (ventas de prueba que se movieron; ver corregir-datos-legacy, paso 7).`);
  const soloNuevo = vNuevo.filter((v) => !idsViejo.has(v.id));
  if (soloNuevo.length) aviso(`${soloNuevo.length} ventas existen solo en el sistema nuevo (cargadas en el nuevo o pedidos de la tienda). Revisar que sean esperables.`);
  // El viejo no restaba el descuento del total (hasta el 11/09); corregir-datos-legacy (paso 1) lo arregló en el nuevo.
  // Una diferencia de total se acepta solo si es exactamente eso: el nuevo = (ítems − descuento) con su interés y el viejo = ítems con su interés.
  const conInteres = (monto, n) => Math.round(monto * (1 + num(n.coeficiente_interes) / 100));
  let porDescuento = 0;
  let plataPorDescuento = 0;
  const raras = [];
  for (const v of vViejo) {
    const n = idsNuevo.get(v.id);
    if (!n) continue;
    const estadoDistinto = Boolean(n.deleted_at) !== Boolean(v.deleted_at);
    const dif = num(n.total_con_interes) - num(v.total_con_interes);
    if (!estadoDistinto && Math.abs(dif) < 1) continue;
    const explicada =
      !estadoDistinto &&
      num(n.descuento) > 0 &&
      Math.abs(num(n.total_con_interes) - conInteres(num(n.items) - num(n.descuento), n)) < 2 &&
      Math.abs(num(v.total_con_interes) - conInteres(num(n.items), n)) < 2;
    if (explicada) {
      porDescuento++;
      if (!n.deleted_at) plataPorDescuento += dif;
    } else raras.push(`${v.numero_venta} (${diaAR(v.fecha)}: viejo ${pesos(num(v.total_con_interes))}${v.deleted_at ? ' anulada' : ''}, nuevo ${pesos(num(n.total_con_interes))}${n.deleted_at ? ' anulada' : ''})`);
  }
  if (porDescuento) ok(`${porDescuento} ventas tienen un total menor en el nuevo, y en todas es exactamente el descuento que el viejo no restaba (error del viejo hasta el 11/09, corregido).`);
  if (raras.length) mal(`${raras.length} ventas tienen otro total o estado sin explicación: ${raras.slice(0, 10).join('; ')}${raras.length > 10 ? '…' : ''}`);
  else ok('Ninguna otra venta tiene un total o un estado distinto.');

  // Plata por medio de pago (lo que tiene que dar la caja), sobre las ventas comunes vigentes.
  const porMedio = (lista) =>
    lista.reduce((acc, v) => {
      if (!v.deleted_at) acc[v.forma_pago ?? 'sin_dato'] = (acc[v.forma_pago ?? 'sin_dato'] ?? 0) + num(v.total_con_interes);
      return acc;
    }, {});
  const comunesViejo = vViejo.filter((v) => idsNuevo.has(v.id));
  const comunesNuevo = comunesViejo.map((v) => idsNuevo.get(v.id));
  const mv = porMedio(comunesViejo);
  const mn = porMedio(comunesNuevo);
  linea('\n| Medio de pago | Viejo | Nuevo | Diferencia |');
  linea('|---|---:|---:|---:|');
  for (const medio of [...new Set([...Object.keys(mv), ...Object.keys(mn)])].sort()) {
    const d = (mn[medio] ?? 0) - (mv[medio] ?? 0);
    linea(`| ${medio} | ${pesos(mv[medio] ?? 0)} | ${pesos(mn[medio] ?? 0)} | ${Math.abs(d) < 1 ? '—' : pesos(d)} |`);
  }
  const totalV = Object.values(mv).reduce((a, b) => a + b, 0);
  const totalN = Object.values(mn).reduce((a, b) => a + b, 0);
  linea(`| **Total** | **${pesos(totalV)}** | **${pesos(totalN)}** | ${Math.abs(totalN - totalV) < 1 ? '—' : pesos(totalN - totalV)} |`);
  linea('');
  if (Math.abs(totalN - totalV - plataPorDescuento) < 1)
    ok(Math.abs(totalN - totalV) < 1 ? 'La plata de las ventas coincide.' : `La diferencia de plata (${pesos(totalN - totalV)}) es exactamente la suma de esos descuentos.`);
  else mal(`La plata difiere en ${pesos(totalN - totalV)} y los descuentos explican ${pesos(plataPorDescuento)}: hay ${pesos(totalN - totalV - plataPorDescuento)} sin explicar.`);

  // Compras.
  linea('\n### Compras');
  const idsCNuevo = new Set(cNuevo.map((c) => c.id));
  const idsCViejo = new Set(cViejo.map((c) => c.id));
  const cFaltan = cViejo.filter((c) => !idsCNuevo.has(c.id));
  linea(`- Viejo: ${cViejo.length} compras · nuevo: ${cNuevo.length}.`);
  if (cFaltan.length) mal(`Faltan ${cFaltan.length} compras del viejo en el nuevo.`);
  else ok('No falta ninguna compra del sistema viejo.');
  const cSolo = cNuevo.filter((c) => !idsCViejo.has(c.id));
  if (cSolo.length) aviso(`${cSolo.length} compras existen solo en el nuevo (${cSolo.filter((c) => c.deleted_at).length} anuladas). Antes del pase eran pruebas; revisar.`);

  // Stock: diferencias explicadas por los movimientos que existen solo en el nuevo.
  linea('\n### Stock por producto');
  const clave = (m) => `${m.producto_id}|${m.variante_id ?? ''}`;
  const sumar = (lista) =>
    lista.reduce((acc, m) => {
      if (!m.deleted_at) acc.set(clave(m), (acc.get(clave(m)) ?? 0) + num(m.cantidad) * num(m.signo));
      return acc;
    }, new Map());
  const idsMViejo = new Set(mViejo.map((m) => m.id));
  const sViejo = sumar(mViejo);
  const sNuevo = sumar(mNuevo);
  // Movimientos del viejo que no están en el nuevo: solo valen si se movieron a otra empresa a propósito.
  // Los que en el nuevo están dados de baja (correcciones) explican diferencias de stock.
  const idsMNuevo = new Map(mNuevo.map((m) => [m.id, m]));
  const mAusentes = mViejo.filter((m) => !m.deleted_at && !idsMNuevo.has(m.id));
  const mMovidos = mAusentes.length
    ? new Set((await db.query('SELECT id::text FROM movimientos_inventario WHERE id = ANY($1::uuid[]) AND empresa_id <> $2', [mAusentes.map((m) => m.id), EMPRESA])).rows.map((r) => r.id))
    : new Set();
  // El mismo movimiento con otro id: traer-compras-legacy crea las entradas de stock con ids nuevos.
  // Se empareja por comprobante, producto, variante, cantidad y sentido.
  const firma = (m) => `${m.referencia_id ?? ''}|${clave(m)}|${num(m.cantidad)}|${num(m.signo)}`;
  const libres = new Map();
  for (const m of mNuevo) {
    if (idsMViejo.has(m.id) || m.deleted_at || !m.referencia_id) continue;
    (libres.get(firma(m)) ?? libres.set(firma(m), []).get(firma(m))).push(m.id);
  }
  const equivalentes = new Set();
  const nuevosUsados = new Set();
  for (const m of mAusentes) {
    if (mMovidos.has(m.id) || !m.referencia_id) continue;
    const otro = libres.get(firma(m))?.shift();
    if (otro) {
      equivalentes.add(m.id);
      nuevosUsados.add(otro);
    }
  }
  if (equivalentes.size) ok(`${equivalentes.size} movimientos del viejo están en el nuevo con otro número interno (mismo comprobante, producto y cantidad).`);
  const mPerdidos = mAusentes.filter((m) => !mMovidos.has(m.id) && !equivalentes.has(m.id));
  if (mPerdidos.length) mal(`Faltan ${mPerdidos.length} movimientos de stock del viejo en el nuevo (productos: ${[...new Set(mPerdidos.map((m) => nombres.get(m.producto_id) ?? m.producto_id))].slice(0, 8).join(', ')}).`);
  else ok('No falta ningún movimiento de stock del viejo.');
  const sQuitados = sumar(mViejo.filter((m) => !m.deleted_at && !equivalentes.has(m.id) && (mMovidos.has(m.id) || idsMNuevo.get(m.id)?.deleted_at)));
  // Lo propio del nuevo (correcciones, ventas o compras hechas en el nuevo), sin los equivalentes de arriba.
  const sSoloNuevo = sumar(mNuevo.filter((m) => !idsMViejo.has(m.id) && !nuevosUsados.has(m.id)));
  let explicadas = 0;
  const sinExplicar = [];
  for (const k of new Set([...sViejo.keys(), ...sNuevo.keys()])) {
    const d = (sNuevo.get(k) ?? 0) - (sViejo.get(k) ?? 0);
    if (Math.abs(d) < 0.001) continue;
    const explicacion = (sSoloNuevo.get(k) ?? 0) - (sQuitados.get(k) ?? 0);
    if (Math.abs(d - explicacion) < 0.001) explicadas++;
    else sinExplicar.push({ k, d, explicacion });
  }
  if (explicadas) ok(`${explicadas} productos tienen otro stock en el nuevo, y la diferencia la explican exactamente sus movimientos propios (correcciones del viejo, ventas o compras hechas en el nuevo).`);
  if (sinExplicar.length) {
    mal(`${sinExplicar.length} productos tienen una diferencia de stock sin explicar:`);
    for (const s of sinExplicar.slice(0, 20)) linea(`  - ${nombres.get(s.k.split('|')[0]) ?? s.k}: el nuevo tiene ${s.d > 0 ? '+' : ''}${s.d} (lo explicado: ${s.explicacion})`);
  } else ok('El stock de todos los productos cuadra.');

  // Salud general.
  linea('\n### Salud');
  const ajenos = num((await db.query(`SELECT count(*) AS n FROM ventas_items vi JOIN productos p ON p.id = vi.producto_id WHERE vi.empresa_id = $1 AND p.empresa_id <> $1`, [EMPRESA])).rows[0].n);
  if (ajenos) aviso(`${ajenos} ítems de venta apuntan a productos de otra empresa (ver corregir-datos-legacy, paso 8).`);
  else ok('Ningún ítem de venta apunta a productos de otra empresa.');
  const numeracion = (await db.query(`SELECT numero_venta, count(*) AS n FROM ventas WHERE empresa_id = $1 GROUP BY numero_venta HAVING count(*) > 1 LIMIT 5`, [EMPRESA])).rows;
  if (numeracion.length) mal(`Números de venta repetidos: ${numeracion.map((r) => r.numero_venta).join(', ')}`);
  else ok('No hay números de venta repetidos.');
} catch (e) {
  if (!['paso fallido', 'sin copia', 'migraciones', 'sin dist'].includes(e.message)) mal(`Error inesperado: ${e.message}`);
} finally {
  await db.end();
}

linea('\n## Resultado');
linea(problemas ? `❌ **${problemas} problema(s)**: no seguir con el pase hasta resolverlos.` : avisos ? `✅ Sin problemas, con ${avisos} aviso(s) para revisar.` : '✅ Todo cuadra.');
linea(`\n_Tardó ${Math.round((Date.now() - inicio) / 1000)} s._`);
const destino = arg('informe') ?? path.resolve(RAIZ_API, '..', '..', 'backups', `informe-pase-${hoyAR()}-${APLICAR ? 'aplicado' : 'ensayo'}.md`);
fs.mkdirSync(path.dirname(destino), { recursive: true });
fs.writeFileSync(destino, informe.join('\n') + '\n');
console.log(`\nInforme: ${destino}`);
process.exitCode = problemas ? 1 : 0;

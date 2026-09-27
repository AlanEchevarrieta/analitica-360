// Trae las ventas de ciertos días del legacy (Supabase) al Postgres nuevo, sin
// tocar nada más: ventas, sus ítems, sus movimientos de stock y sus anulaciones.
//
// Solo LEE de Supabase (GET). En la base local solo AGREGA filas que no existen
// (por id): correrlo dos veces no duplica nada. Sin --aplicar, solo informa.
//
// Uso (desde apps/api):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/traer-ventas-legacy.mjs \
//     --empresa <uuid> --desde 2026-09-25 --hasta 2026-09-26 [--aplicar]
// Las fechas son días de Argentina (inclusive).

import 'dotenv/config';
import pg from 'pg';

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : null; };
const EMPRESA = arg('empresa');
const DESDE = arg('desde');
const HASTA = arg('hasta');
const APLICAR = process.argv.includes('--aplicar');
const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/+$/, '');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!EMPRESA || !/^\d{4}-\d{2}-\d{2}$/.test(DESDE ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(HASTA ?? '') || !SUPABASE_URL || !KEY || !process.env.DATABASE_URL) {
  console.error('Uso: --empresa <uuid> --desde AAAA-MM-DD --hasta AAAA-MM-DD [--aplicar]  (y SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL)');
  process.exit(1);
}
// Día AR = UTC-3: [desde 00:00, hasta+1 00:00) en hora argentina.
const inicio = new Date(`${DESDE}T03:00:00Z`).toISOString();
const fin = new Date(Date.parse(`${HASTA}T03:00:00Z`) + 86_400_000).toISOString();

async function leer(ruta) {
  const filas = [];
  for (let desde = 0; ; desde += 1000) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, { method: 'GET', headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Range: `${desde}-${desde + 999}` } });
    if (!r.ok) throw new Error(`Supabase ${ruta.split('?')[0]}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    const lote = await r.json();
    filas.push(...lote);
    if (lote.length < 1000) return filas;
  }
}
const enLista = (ids) => `in.(${ids.join(',')})`;

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  const ventas = await leer(`ventas?empresa_id=eq.${EMPRESA}&fecha=gte.${encodeURIComponent(inicio)}&fecha=lt.${encodeURIComponent(fin)}&select=*&order=fecha.asc`);
  const ids = ventas.map((v) => v.id);
  const [items, movimientos, anulaciones] = ids.length
    ? await Promise.all([
        leer(`ventas_items?venta_id=${enLista(ids)}&select=*`),
        leer(`movimientos_inventario?referencia_id=${enLista(ids)}&select=*`),
        leer(`anulaciones?venta_id=${enLista(ids)}&select=*`),
      ])
    : [[], [], []];
  console.log(`Legacy ${DESDE} a ${HASTA}: ${ventas.length} ventas (${ventas.filter((v) => v.deleted_at).length} anuladas), ${items.length} ítems, ${movimientos.length} movimientos de stock, ${anulaciones.length} anulaciones`);

  // Qué ya existe localmente (por id) y posibles choques de número de venta.
  const existentes = new Set((await db.query('SELECT id FROM ventas WHERE id = ANY($1::uuid[])', [ids])).rows.map((r) => r.id));
  const nuevas = ventas.filter((v) => !existentes.has(v.id));
  const choque = (await db.query('SELECT numero_venta FROM ventas WHERE empresa_id = $1 AND numero_venta = ANY($2) AND NOT (id = ANY($3::uuid[]))', [EMPRESA, ventas.map((v) => v.numero_venta), ids])).rows;
  if (choque.length) throw new Error(`Números de venta ya usados localmente por otras ventas: ${choque.map((r) => r.numero_venta).join(', ')}`);

  // Referencias que tienen que existir en la base nueva.
  const faltan = [];
  const verificar = async (tabla, lista, que) => {
    const unicos = [...new Set(lista.filter(Boolean))];
    if (!unicos.length) return;
    const hay = new Set((await db.query(`SELECT id FROM ${tabla} WHERE id = ANY($1::uuid[])`, [unicos])).rows.map((r) => r.id));
    for (const id of unicos) if (!hay.has(id)) faltan.push(`${que} ${id}`);
  };
  await verificar('productos', [...items.map((i) => i.producto_id), ...movimientos.map((m) => m.producto_id)], 'producto');
  await verificar('producto_variantes', [...items.map((i) => i.variante_id), ...movimientos.map((m) => m.variante_id)], 'variante');
  await verificar('usuarios', [...ventas.map((v) => v.usuario_id), ...movimientos.map((m) => m.usuario_id), ...anulaciones.map((a) => a.usuario_id)], 'usuario');
  await verificar('clientes', ventas.map((v) => v.cliente_id), 'cliente');
  if (faltan.length) throw new Error(`Faltan en la base nueva (no se copió nada): ${faltan.join(', ')}`);

  const porDia = {};
  for (const v of nuevas) {
    const dia = new Date(Date.parse(v.fecha) - 3 * 3600_000).toISOString().slice(0, 10);
    porDia[dia] ??= { ventas: 0, anuladas: 0, total: 0 };
    porDia[dia].ventas += 1;
    if (v.deleted_at) porDia[dia].anuladas += 1;
    else porDia[dia].total += Number(v.total_con_interes ?? 0);
  }
  console.log(`Nuevas para copiar: ${nuevas.length} (ya estaban: ${existentes.size})`);
  for (const [dia, d] of Object.entries(porDia)) console.log(`  ${dia}: ${d.ventas} ventas (${d.anuladas} anuladas) · vendido $${d.total.toLocaleString('es-AR')}`);
  if (!APLICAR) {
    console.log('Modo prueba: no se copió nada. Agregá --aplicar para copiar.');
  } else {
    const cols = async (tabla) => new Set((await db.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`, [tabla])).rows.map((r) => r.column_name));
    const insertar = async (tabla, filas) => {
      if (!filas.length) return 0;
      const locales = await cols(tabla);
      let n = 0;
      for (const f of filas) {
        const pares = Object.entries(f).filter(([k, v]) => locales.has(k) && v !== null);
        const sql = `INSERT INTO "${tabla}" (${pares.map(([k]) => `"${k}"`).join(', ')}) VALUES (${pares.map((_, i) => `$${i + 1}`).join(', ')}) ON CONFLICT (id) DO NOTHING`;
        n += (await db.query(sql, pares.map(([, v]) => (typeof v === 'object' ? JSON.stringify(v) : v)))).rowCount;
      }
      return n;
    };
    await db.query('BEGIN');
    const nv = await insertar('ventas', ventas);
    const ni = await insertar('ventas_items', items);
    const nm = await insertar('movimientos_inventario', movimientos);
    const na = await insertar('anulaciones', anulaciones);
    // La numeración sigue desde el número más alto (nunca baja).
    const maximo = Math.max(0, ...ventas.map((v) => Number(String(v.numero_venta ?? '').replace(/\D/g, '')) || 0));
    await db.query(
      `INSERT INTO ventas_numeracion (empresa_id, ultimo) VALUES ($1, $2) ON CONFLICT (empresa_id) DO UPDATE SET ultimo = GREATEST(ventas_numeracion.ultimo, EXCLUDED.ultimo)`,
      [EMPRESA, maximo],
    );
    await db.query('COMMIT');
    console.log(`Copiado: ${nv} ventas, ${ni} ítems, ${nm} movimientos, ${na} anulaciones. Numeración local ≥ ${maximo}.`);
  }
} catch (e) {
  await db.query('ROLLBACK').catch(() => {});
  console.error('ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await db.end();
}

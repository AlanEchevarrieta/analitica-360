// Copia los datos del legacy (Supabase) al Postgres nuevo (DATABASE_URL).
//
// Solo LEE de Supabase (REST con service role) y escribe en la base local.
// Uso (desde apps/api):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrar-desde-supabase.mjs [--reset]
//
// --reset vacía primero todas las tablas locales (para re-correr la migración).
// Sin --reset se niega a correr si la base local ya tiene empresas.
//
// Las tablas se copian en orden de dependencias (FKs leídas de la base local);
// de cada fila solo se copian las columnas que existen en el schema nuevo.
// Si un lote falla, se reintenta fila por fila y se informan las que no entran.

import 'dotenv/config';
import pg from 'pg';

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/+$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESET = process.argv.includes('--reset');
const PAGINA = 1000; // máximo por request de PostgREST en Supabase
const LOTE_INSERT = 500;

if (!SUPABASE_URL || !SUPABASE_KEY || !process.env.DATABASE_URL) {
  console.error('Faltan SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o DATABASE_URL');
  process.exit(1);
}

// Tablas que existen solo en el schema nuevo: se calculan al final.
const CALCULADAS = new Set(['tickets_numeracion']);

// Ajustes por tabla para diferencias entre el legacy y el schema nuevo.
// Devolver null descarta la fila (se cuenta como omitida con el motivo).
const TRANSFORMAR = {
  aceptaciones_terminos: (f) => ({ ...f, created_at: f.aceptado_at ?? f.created_at }),
  // El schema nuevo no tiene deleted_at en pedidos: un pedido borrado queda cancelado.
  pedidos: (f) => (f.deleted_at ? { ...f, estado: 'cancelado' } : f),
  // El schema nuevo solo registra anulaciones de ventas (venta_id NOT NULL).
  anulaciones: (f) => (f.venta_id ? f : null),
};
const MOTIVO_OMISION = { anulaciones: 'anulación de compra (el schema nuevo solo guarda anulaciones de ventas)' };

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

async function columnasLocales() {
  const { rows } = await db.query(`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name <> '_prisma_migrations'
    ORDER BY table_name, ordinal_position`);
  const out = new Map();
  for (const r of rows) {
    if (!out.has(r.table_name)) out.set(r.table_name, []);
    out.get(r.table_name).push(r.column_name);
  }
  return out;
}

async function clavesPrimarias() {
  const { rows } = await db.query(`
    SELECT tc.table_name, kcu.column_name FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
    WHERE tc.table_schema = 'public' AND tc.constraint_type = 'PRIMARY KEY'
    ORDER BY kcu.ordinal_position`);
  const out = new Map();
  for (const r of rows) if (!out.has(r.table_name)) out.set(r.table_name, r.column_name);
  return out;
}

/** Orden topológico: cada tabla después de las tablas a las que referencia. */
async function ordenPorDependencias(tablas) {
  const { rows } = await db.query(`
    SELECT DISTINCT tc.table_name AS hija, ccu.table_name AS padre
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.table_schema = 'public' AND tc.constraint_type = 'FOREIGN KEY'`);
  const padres = new Map(tablas.map((t) => [t, new Set()]));
  for (const r of rows) if (r.hija !== r.padre && padres.has(r.hija)) padres.get(r.hija).add(r.padre);
  const orden = [];
  const visitadas = new Set();
  const visitar = (t, camino = new Set()) => {
    if (visitadas.has(t)) return;
    if (camino.has(t)) throw new Error(`Ciclo de FKs en ${t}`);
    camino.add(t);
    for (const p of padres.get(t) ?? []) visitar(p, camino);
    visitadas.add(t);
    orden.push(t);
  };
  for (const t of tablas) visitar(t);
  return orden;
}

async function leerSupabase(tabla, orden) {
  const filas = [];
  for (let desde = 0; ; desde += PAGINA) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${tabla}?select=*&order=${orden}.asc`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Range: `${desde}-${desde + PAGINA - 1}`,
      },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Supabase ${tabla}: ${res.status} ${await res.text()}`);
    const pagina = await res.json();
    filas.push(...pagina);
    if (pagina.length < PAGINA) return filas;
  }
}

async function insertar(tabla, columnasLocales, filas) {
  // Solo las columnas que vienen del legacy: las nuevas (ej. usa_variantes)
  // quedan fuera del INSERT para que apliquen su DEFAULT en vez de NULL.
  const presentes = new Set(filas.flatMap((f) => Object.keys(f)));
  const columnas = columnasLocales.filter((c) => presentes.has(c));
  if (columnas.length === 0) return { ok: 0, fallidas: [] };
  const lista = columnas.map((c) => `"${c}"`).join(', ');
  const sql = `INSERT INTO "${tabla}" (${lista})
    SELECT ${lista} FROM json_populate_recordset(NULL::"${tabla}", $1::json)
    ON CONFLICT DO NOTHING`;
  const proyectar = (f) => Object.fromEntries(columnas.filter((c) => c in f).map((c) => [c, f[c]]));
  let ok = 0;
  const fallidas = [];
  for (let i = 0; i < filas.length; i += LOTE_INSERT) {
    const lote = filas.slice(i, i + LOTE_INSERT);
    try {
      const r = await db.query(sql, [JSON.stringify(lote.map(proyectar))]);
      ok += r.rowCount;
    } catch {
      for (const fila of lote) {
        try {
          const r = await db.query(sql, [JSON.stringify([proyectar(fila)])]);
          ok += r.rowCount;
        } catch (error) {
          fallidas.push({ id: fila.id ?? JSON.stringify(fila).slice(0, 80), error: error.message });
        }
      }
    }
  }
  return { ok, fallidas };
}

async function main() {
  const columnas = await columnasLocales();
  const pks = await clavesPrimarias();
  const tablas = await ordenPorDependencias([...columnas.keys()]);

  const { rows: [{ n }] } = await db.query('SELECT count(*)::int AS n FROM empresas');
  if (n > 0 && !RESET) {
    console.error(`La base local ya tiene ${n} empresas. Usá --reset para vaciarla y migrar de nuevo.`);
    process.exit(1);
  }
  if (RESET) {
    await db.query(`TRUNCATE ${tablas.map((t) => `"${t}"`).join(', ')} CASCADE`);
    console.log('Base local vaciada.');
  }

  const resumen = [];
  for (const tabla of tablas) {
    if (CALCULADAS.has(tabla)) continue;
    const filas = await leerSupabase(tabla, pks.get(tabla) ?? 'id');
    if (filas === null) {
      resumen.push({ tabla, supabase: '-', copiadas: 0, nota: 'no existe en Supabase' });
      continue;
    }
    const transformar = TRANSFORMAR[tabla] ?? ((f) => f);
    const aCopiar = filas.map(transformar).filter(Boolean);
    const omitidas = filas.length - aCopiar.length;
    const { ok, fallidas } = await insertar(tabla, columnas.get(tabla), aCopiar);
    const notas = [];
    if (omitidas) notas.push(`${omitidas} omitidas: ${MOTIVO_OMISION[tabla] ?? 'transformación'}`);
    if (fallidas.length) notas.push(`${fallidas.length} con error (ej: ${fallidas[0].error})`);
    resumen.push({ tabla, supabase: filas.length, copiadas: ok, nota: notas.join(' · ') });
    process.stdout.write(`  ${tabla}: ${ok}/${filas.length}\n`);
  }

  // Derivados que el legacy no guardaba.
  await db.query(`
    UPDATE productos p SET usa_variantes = TRUE
    WHERE EXISTS (SELECT 1 FROM producto_variantes v WHERE v.producto_id = p.id AND v.deleted_at IS NULL)`);
  // Numerador global de tickets (en el legacy era una secuencia): arranca
  // después del mayor número ya usado para no repetir numero_ticket (UNIQUE).
  await db.query(`
    INSERT INTO tickets_numeracion (id, ultimo)
    SELECT 1, COALESCE(MAX(NULLIF(regexp_replace(numero_ticket, '\\D', '', 'g'), '')::bigint), 0) FROM tickets
    ON CONFLICT (id) DO UPDATE SET ultimo = EXCLUDED.ultimo`);

  console.log('\nResumen:');
  console.table(resumen);
  await db.end();
}

main().catch(async (error) => {
  console.error(error);
  await db.end();
  process.exit(1);
});

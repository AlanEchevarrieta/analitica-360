// Corrige inconsistencias heredadas del legacy (Supabase) en una empresa.
// Idempotente: correrlo dos veces no cambia nada la segunda vez. Pensado para
// correr después de migrar-desde-supabase.mjs.
//
// Uso (desde apps/api): node scripts/corregir-datos-legacy.mjs --empresa <uuid> [--aplicar]
// Sin --aplicar solo informa qué haría (dry run).
//
// 1. Ventas con descuento guardado pero no restado del total (bug de la
//    pantalla de nueva venta del legacy hasta 2026-09-11): recalcula
//    total_sin_interes = items - descuento y total_con_interes con su interés.
// 2. Ventas anuladas cuyo stock nunca se devolvió: crea el movimiento inverso.
// 3. Compras anuladas cuyo stock nunca se revirtió: crea el movimiento inverso.
// 4. Stock en variantes borradas/inactivas (o a nivel producto cuando el
//    producto usa variantes): si el producto tiene UNA sola variante activa,
//    lo consolida ahí con ajustes; si tiene varias, solo lo informa.

import 'dotenv/config';
import pg from 'pg';

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const empresa = arg('empresa');
const APLICAR = process.argv.includes('--aplicar');
if (!empresa) {
  console.error('Uso: node scripts/corregir-datos-legacy.mjs --empresa <uuid> [--aplicar]');
  process.exit(1);
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const q = (sql, params = []) => db.query(sql, params);

try {
  await q('BEGIN');

  // Usuario al que se atribuyen los movimientos correctivos: el dueño.
  const { rows: [dueno] } = await q(
    `SELECT id FROM usuarios WHERE empresa_id = $1 ORDER BY (rol = 'dueno') DESC, created_at LIMIT 1`,
    [empresa],
  );
  if (!dueno) throw new Error('La empresa no tiene usuarios');

  // 1. Totales de ventas sin descuento aplicado (solo ventas sin seña: con
  //    seña habría que recalcular también el saldo y eso se revisa a mano).
  const totales = await q(
    `WITH items AS (
       SELECT venta_id, SUM(cantidad * precio_unitario) AS total FROM ventas_items GROUP BY venta_id
     )
     UPDATE ventas v SET
       total_sin_interes = i.total - v.descuento,
       total_con_interes = ROUND((i.total - v.descuento) * (1 + COALESCE(v.coeficiente_interes, 0) / 100.0), 2)
     FROM items i
     WHERE i.venta_id = v.id AND v.empresa_id = $1 AND NOT v.es_senia AND v.descuento > 0
       AND ABS(v.total_sin_interes - (i.total - v.descuento)) > 1
     RETURNING v.id`,
    [empresa],
  );
  const conSenia = await q(
    `SELECT count(*)::int AS n FROM ventas v WHERE v.empresa_id = $1 AND v.es_senia AND v.descuento > 0
       AND ABS(v.total_sin_interes - ((SELECT COALESCE(SUM(cantidad * precio_unitario), 0) FROM ventas_items i WHERE i.venta_id = v.id) - v.descuento)) > 1`,
    [empresa],
  );
  console.log(`1. Ventas con total recalculado (descuento): ${totales.rowCount}` +
    (conSenia.rows[0].n ? ` · ${conSenia.rows[0].n} con seña para revisar a mano` : ''));

  // 2 y 3. Anulaciones sin reversión: por documento anulado y producto/variante,
  // lo que quedó neto se revierte con un movimiento inverso.
  for (const [nombre, tabla, tipo] of [
    ['Ventas', 'ventas', 'venta'],
    ['Compras', 'compras', 'compra'],
  ]) {
    const r = await q(
      `INSERT INTO movimientos_inventario
         (id, empresa_id, producto_id, variante_id, usuario_id, tipo, cantidad, signo, motivo, referencia_id, fecha)
       SELECT gen_random_uuid(), $1, m.producto_id, m.variante_id, $2, $3,
              ABS(SUM(m.signo * m.cantidad)), -SIGN(SUM(m.signo * m.cantidad))::smallint,
              'Corrección: anulación sin reversión de stock (legacy)', d.id, now()
       FROM ${tabla} d
       JOIN movimientos_inventario m ON m.referencia_id = d.id AND m.deleted_at IS NULL
       WHERE d.empresa_id = $1 AND d.deleted_at IS NOT NULL
       GROUP BY d.id, m.producto_id, m.variante_id
       HAVING SUM(m.signo * m.cantidad) <> 0
       RETURNING cantidad`,
      [empresa, dueno.id, tipo],
    );
    const unidades = r.rows.reduce((acc, f) => acc + Number(f.cantidad), 0);
    console.log(`${nombre === 'Ventas' ? 2 : 3}. ${nombre} anuladas revertidas: ${r.rowCount} movimientos, ${unidades} unidades`);
  }

  // 4. Stock varado en variantes borradas/inactivas o a nivel producto.
  const varados = await q(
    `WITH activas AS (
       SELECT producto_id, array_agg(id) AS ids FROM producto_variantes
       WHERE empresa_id = $1 AND deleted_at IS NULL AND activo GROUP BY producto_id
     ),
     stock AS (
       SELECT m.producto_id, m.variante_id, SUM(m.signo * m.cantidad) AS stock
       FROM movimientos_inventario m WHERE m.empresa_id = $1 AND m.deleted_at IS NULL
       GROUP BY m.producto_id, m.variante_id
     )
     SELECT s.producto_id, s.variante_id, s.stock, a.ids, p.nombre
     FROM stock s JOIN activas a ON a.producto_id = s.producto_id JOIN productos p ON p.id = s.producto_id
     WHERE s.stock <> 0 AND (s.variante_id IS NULL OR NOT s.variante_id = ANY (a.ids))`,
    [empresa],
  );
  let consolidados = 0;
  const aRevisar = new Set();
  for (const f of varados.rows) {
    if (f.ids.length !== 1) {
      aRevisar.add(f.nombre);
      continue;
    }
    const cantidad = Math.abs(Number(f.stock));
    const sale = Number(f.stock) > 0; // stock positivo varado: sale del balde viejo y entra a la variante activa
    const motivo = 'Corrección: consolidar stock de variante borrada / sin variante en la variante activa';
    await q(
      `INSERT INTO movimientos_inventario (id, empresa_id, producto_id, variante_id, usuario_id, tipo, cantidad, signo, motivo, fecha)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, now()),
              (gen_random_uuid(), $1, $2, $9, $4, $10, $6, $11, $8, now())`,
      [
        empresa, f.producto_id, f.variante_id, dueno.id,
        sale ? 'ajuste_negativo' : 'ajuste_positivo', cantidad, sale ? -1 : 1, motivo,
        f.ids[0], sale ? 'ajuste_positivo' : 'ajuste_negativo', sale ? 1 : -1,
      ],
    );
    consolidados++;
  }
  console.log(`4. Stock consolidado en la variante activa: ${consolidados} baldes` +
    (aRevisar.size ? ` · revisar a mano (varias variantes activas): ${[...aRevisar].join(', ')}` : ''));

  await q(APLICAR ? 'COMMIT' : 'ROLLBACK');
  console.log(APLICAR ? '\nCorrecciones aplicadas.' : '\nDry run: no se guardó nada. Usá --aplicar para guardar.');
} catch (error) {
  await q('ROLLBACK');
  throw error;
} finally {
  await db.end();
}

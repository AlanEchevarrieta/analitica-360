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
// 5. Compras con proveedor escrito a mano: se vinculan al proveedor cuyo
//    nombre coincide (sin mayúsculas ni tildes).
// 6. Productos con la categoría como texto: se vinculan a la tabla de
//    categorías (creándola si no existe).
// 7. Ventas anuladas que en realidad son de OTRA empresa: todos sus productos,
//    su vendedor y su cliente son de esa otra empresa. Se mueven allá con sus
//    ítems, su anulación y sus movimientos de stock, y queda en la bitácora.
// 8. Solo informa lo que siga apuntando a productos de otra empresa.

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

  // 7. (Va antes de 2 y 3: si no, el paso 2 crearía reversiones de más para estas ventas.)
  //    Ventas anuladas de otra empresa (legacy): las de prueba que Belén hizo en
  //    "Empresa Prueba" el 2026-09-08 quedaron con la cabecera en Acacia. Si todo lo
  //    que la venta referencia (productos, vendedor, cliente) es de UNA misma otra
  //    empresa, la venta es de esa empresa. Solo anuladas: no cambia stock ni reportes.
  const ajenas = await q(
    `SELECT v.id, v.numero_venta, MIN(p.empresa_id::text)::uuid AS destino, MIN(e.nombre) AS destino_nombre
     FROM ventas v
     JOIN ventas_items i ON i.venta_id = v.id
     JOIN productos p ON p.id = i.producto_id
     JOIN empresas e ON e.id = p.empresa_id
     JOIN usuarios u ON u.id = v.usuario_id
     LEFT JOIN clientes c ON c.id = v.cliente_id
     WHERE v.empresa_id = $1 AND v.deleted_at IS NOT NULL
       AND EXISTS (SELECT 1 FROM anulaciones a WHERE a.venta_id = v.id)
     GROUP BY v.id, v.numero_venta, u.empresa_id, c.empresa_id
     HAVING COUNT(DISTINCT p.empresa_id) = 1 AND MIN(p.empresa_id::text)::uuid <> $1
        AND u.empresa_id = MIN(p.empresa_id::text)::uuid
        AND (c.empresa_id IS NULL OR c.empresa_id = MIN(p.empresa_id::text)::uuid)`,
    [empresa],
  );
  for (const v of ajenas.rows) {
    await q(`UPDATE ventas SET empresa_id = $2 WHERE id = $1`, [v.id, v.destino]);
    await q(`UPDATE ventas_items SET empresa_id = $2 WHERE venta_id = $1`, [v.id, v.destino]);
    await q(`UPDATE anulaciones SET empresa_id = $2 WHERE venta_id = $1`, [v.id, v.destino]);
    await q(`UPDATE movimientos_inventario SET empresa_id = $2 WHERE referencia_id = $1`, [v.id, v.destino]);
    // SQL directo: la extensión de auditoría no lo ve, así que se asienta a mano en las dos empresas.
    for (const [duena, texto] of [
      [empresa, `movió venta «${v.numero_venta}» a «${v.destino_nombre}»: venta de prueba anulada del sistema viejo; sus productos, cliente y vendedor son de esa empresa`],
      [v.destino, `recibió venta «${v.numero_venta}» que había quedado cargada en otra empresa (sistema viejo)`],
    ]) {
      await q(
        `INSERT INTO registro_auditoria (empresa_id, actor_tipo, actor_nombre, accion, entidad, entidad_id, entidad_nombre, resumen, cambios, ruta)
         VALUES ($1, 'sistema', 'Corrección de datos (Analítica 360)', 'editar', 'Venta', $2, $3, $4, $5, 'scripts/corregir-datos-legacy.mjs')`,
        [duena, v.id, v.numero_venta, texto, JSON.stringify({ empresaId: [empresa, v.destino] })],
      );
    }
  }
  console.log(`7. Ventas anuladas devueltas a su empresa: ${ajenas.rowCount}` +
    (ajenas.rowCount ? ` · ${ajenas.rows.map((v) => v.numero_venta).join(', ')} → ${[...new Set(ajenas.rows.map((v) => v.destino_nombre))].join(', ')}` : ''));

  // 2 y 3. Anulaciones sin reversión: por documento anulado y producto/variante,
  // lo que quedó neto se revierte con un movimiento inverso.
  for (const [nombre, tabla, tipo] of [
    ['Ventas', 'ventas', 'venta'],
    ['Compras', 'compras', 'compra'],
  ]) {
    const r = await q(
      `INSERT INTO movimientos_inventario
         (id, empresa_id, producto_id, variante_id, usuario_id, tipo, cantidad, signo, motivo, referencia_id, fecha)
       SELECT gen_random_uuid(), m.empresa_id, m.producto_id, m.variante_id, $2, $3,
              ABS(SUM(m.signo * m.cantidad)), -SIGN(SUM(m.signo * m.cantidad))::smallint,
              'Corrección: anulación sin reversión de stock (legacy)', d.id, now()
       FROM ${tabla} d
       JOIN movimientos_inventario m ON m.referencia_id = d.id AND m.deleted_at IS NULL
       WHERE d.empresa_id = $1 AND d.deleted_at IS NOT NULL
       -- La reversión va en la empresa del movimiento original (antes iba en $1 y dejó
       -- devoluciones de "Empresa Prueba" cargadas en Acacia; las arregla el paso 7).
       GROUP BY d.id, m.empresa_id, m.producto_id, m.variante_id
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

  // 5. Compras con el proveedor escrito a mano pero sin vincular: se vinculan
  //    si el nombre coincide sin importar mayúsculas ni tildes.
  const norm = (col) => `translate(lower(trim(${col})), 'áéíóúüñ', 'aeiouun')`;
  const vinculadas = await q(
    `UPDATE compras c SET proveedor_id = p.id
     FROM proveedores p
     WHERE c.empresa_id = $1 AND p.empresa_id = $1 AND c.proveedor_id IS NULL AND c.proveedor IS NOT NULL
       AND p.deleted_at IS NULL AND ${norm('c.proveedor')} = ${norm('p.nombre')}
       AND (SELECT count(*) FROM proveedores p2 WHERE p2.empresa_id = $1 AND p2.deleted_at IS NULL AND ${norm('p2.nombre')} = ${norm('c.proveedor')}) = 1
     RETURNING c.id`,
    [empresa],
  );
  const sinVincular = await q(
    `SELECT proveedor, count(*)::int AS n FROM compras WHERE empresa_id = $1 AND proveedor_id IS NULL AND trim(coalesce(proveedor, '')) <> '' GROUP BY 1`,
    [empresa],
  );
  console.log(`5. Compras vinculadas a su proveedor: ${vinculadas.rowCount}` +
    (sinVincular.rowCount ? ` · sin proveedor que coincida: ${sinVincular.rows.map((r) => `"${r.proveedor}" (${r.n})`).join(', ')}` : ''));

  // 6. Productos con la categoría escrita como texto (legacy) sin vincular a la
  //    tabla de categorías: se crea la categoría si falta y se vincula.
  const creadas = await q(
    `INSERT INTO categorias (id, empresa_id, nombre)
     SELECT gen_random_uuid(), $1, min(trim(p.categoria))
     FROM productos p
     WHERE p.empresa_id = $1 AND p.categoria_id IS NULL AND trim(coalesce(p.categoria, '')) <> ''
       AND NOT EXISTS (SELECT 1 FROM categorias c WHERE c.empresa_id = $1 AND ${norm('c.nombre')} = ${norm('p.categoria')})
     GROUP BY ${norm('p.categoria')}
     RETURNING nombre`,
    [empresa],
  );
  const categorizados = await q(
    `UPDATE productos p SET categoria_id = c.id
     FROM categorias c
     WHERE p.empresa_id = $1 AND c.empresa_id = $1 AND p.categoria_id IS NULL
       AND ${norm('p.categoria')} = ${norm('c.nombre')}
     RETURNING p.id`,
    [empresa],
  );
  console.log(`6. Productos vinculados a su categoría: ${categorizados.rowCount}` +
    (creadas.rowCount ? ` · categorías creadas: ${creadas.rows.map((r) => r.nombre).join(', ')}` : ''));

  // 8. Solo informa: movimientos de stock de esta empresa que apuntan a productos
  //    de OTRA empresa (datos del legacy). No suman en ningún cálculo (las consultas
  //    filtran por empresa), pero hay que decidir a mano a qué producto corresponden.
  const ajenos = await q(
    `SELECT p.nombre, e.nombre AS duena, COUNT(*)::int AS movimientos, SUM(m.cantidad * m.signo)::int AS stock
     FROM movimientos_inventario m JOIN productos p ON p.id = m.producto_id JOIN empresas e ON e.id = p.empresa_id
     WHERE m.empresa_id = $1 AND p.empresa_id <> $1 AND m.deleted_at IS NULL
     GROUP BY p.nombre, e.nombre ORDER BY p.nombre`,
    [empresa],
  );
  console.log(`8. Movimientos que apuntan a productos de otra empresa: ${ajenos.rows.reduce((a, r) => a + r.movimientos, 0)}` +
    (ajenos.rowCount ? ` · revisar a mano: ${ajenos.rows.map((r) => `${r.nombre} de "${r.duena}" (${r.movimientos} mov., stock ${r.stock})`).join(', ')}` : ''));

  await q(APLICAR ? 'COMMIT' : 'ROLLBACK');
  console.log(APLICAR ? '\nCorrecciones aplicadas.' : '\nDry run: no se guardó nada. Usá --aplicar para guardar.');
} catch (error) {
  await q('ROLLBACK');
  throw error;
} finally {
  await db.end();
}

// Trae del legacy (Supabase) las compras que faltan en el Postgres nuevo:
// compras, sus ítems y la entrada de stock, y actualiza el costo promedio
// ponderado igual que ComprasRepository.crear (flete/impuestos/otros
// prorrateados, PPP con el stock previo, registro en precios_historial).
//
// Solo LEE de Supabase (GET). En la base local solo AGREGA compras que no
// existen (por id): correrlo dos veces no duplica nada. Sin --aplicar, solo informa.
//
// Uso (desde apps/api):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/traer-compras-legacy.mjs \
//     --empresa <uuid> [--aplicar]

import 'dotenv/config';
import pg from 'pg';

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : null; };
const EMPRESA = arg('empresa');
const APLICAR = process.argv.includes('--aplicar');
const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/+$/, '');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!EMPRESA || !SUPABASE_URL || !KEY || !process.env.DATABASE_URL) {
  console.error('Uso: --empresa <uuid> [--aplicar]  (y SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL)');
  process.exit(1);
}

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
const num = (v) => Number(v ?? 0) || 0;
const redondear = (n) => Math.round(n * 100) / 100;
const pesos = (n) => `$${Math.round(n).toLocaleString('es-AR')}`;

// Mismas fórmulas que src/modules/inventario/costo-promedio.ts.
function costoUnitarioConAdicionales(items, totalAdicionales) {
  const subtotal = items.reduce((acc, i) => acc + i.cantidad * i.costoUnitario, 0);
  if (totalAdicionales <= 0 || subtotal <= 0) return items.map((i) => i.costoUnitario);
  return items.map((i) => redondear(i.costoUnitario + (i.cantidad * i.costoUnitario * totalAdicionales) / subtotal / i.cantidad));
}
function costoPromedioPonderado(stockPrevio, costoPrevio, cantidad, costoNuevo) {
  const stock = Math.max(0, stockPrevio);
  if (!costoPrevio || costoPrevio <= 0 || stock === 0) return redondear(costoNuevo);
  return redondear((stock * costoPrevio + cantidad * costoNuevo) / (stock + cantidad));
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  const locales = new Set((await db.query('SELECT id FROM compras WHERE empresa_id = $1', [EMPRESA])).rows.map((r) => r.id));
  const legacy = await leer(`compras?empresa_id=eq.${EMPRESA}&select=*&order=fecha.asc,created_at.asc`);
  const compras = legacy.filter((c) => !locales.has(c.id));
  const ids = compras.map((c) => c.id);
  const [items, movimientos] = ids.length
    ? await Promise.all([leer(`compras_items?compra_id=${enLista(ids)}&select=*`), leer(`movimientos_inventario?referencia_id=${enLista(ids)}&select=*`)])
    : [[], []];
  console.log(`Legacy: ${legacy.length} compras · faltan en la base nueva: ${compras.length} (${items.length} ítems, ${movimientos.length} movimientos de stock en el legacy)`);
  if (!compras.length) process.exit(0);

  // Productos dados de alta en el legacy después de la migración: se traen
  // tal cual (mismo id) si no tienen variantes; con variantes se frena.
  const idsProductos = [...new Set(items.map((i) => i.producto_id).filter(Boolean))];
  const yaEstan = new Set((await db.query('SELECT id FROM productos WHERE id = ANY($1::uuid[])', [idsProductos])).rows.map((r) => r.id));
  const productosNuevos = idsProductos.filter((id) => !yaEstan.has(id)).length
    ? await leer(`productos?id=${enLista(idsProductos.filter((id) => !yaEstan.has(id)))}&select=*`)
    : [];
  if (productosNuevos.length) {
    const variantesNuevas = await leer(`producto_variantes?producto_id=${enLista(productosNuevos.map((p) => p.id))}&select=id`);
    if (variantesNuevas.length) throw new Error('Hay productos nuevos del legacy con variantes: cargarlos a mano antes (no se copió nada)');
    console.log(`Productos nuevos del legacy que se traen: ${productosNuevos.map((p) => `${p.nombre} (${pesos(num(p.precio_venta))})`).join(', ')}`);
  }

  // Referencias que tienen que existir en la base nueva.
  const faltan = [];
  const verificar = async (tabla, lista, que) => {
    const unicos = [...new Set(lista.filter(Boolean))];
    if (!unicos.length) return;
    const hay = new Set((await db.query(`SELECT id FROM ${tabla} WHERE id = ANY($1::uuid[])`, [unicos])).rows.map((r) => r.id));
    for (const id of unicos) if (!hay.has(id)) faltan.push(`${que} ${id}`);
  };
  const idsNuevos = new Set(productosNuevos.map((p) => p.id));
  await verificar('productos', items.map((i) => i.producto_id).filter((id) => !idsNuevos.has(id)), 'producto');
  await verificar('producto_variantes', items.map((i) => i.variante_id), 'variante');
  await verificar('usuarios', compras.map((c) => c.usuario_id), 'usuario');
  await verificar('proveedores', compras.map((c) => c.proveedor_id), 'proveedor');
  if (faltan.length) throw new Error(`Faltan en la base nueva (no se copió nada): ${faltan.join(', ')}`);

  // Productos con variantes: la entrada de stock tiene que ir a una variante.
  const conVariantes = new Set((await db.query('SELECT id FROM productos WHERE empresa_id = $1 AND usa_variantes', [EMPRESA])).rows.map((r) => r.id));
  const sinVariante = items.filter((i) => conVariantes.has(i.producto_id) && !i.variante_id);

  const itemsDe = (id) => items.filter((i) => i.compra_id === id);
  for (const c of compras) {
    const its = itemsDe(c.id);
    const adicionales = num(c.costo_flete) + num(c.costo_impuestos) + num(c.costo_otros);
    const sumaItems = its.reduce((a, i) => a + num(i.cantidad) * num(i.costo_unitario), 0);
    console.log(`  ${String(c.fecha).slice(0, 10)} · ${c.proveedor ?? '(sin proveedor)'} · total ${pesos(num(c.total))}${adicionales ? ` + adicionales ${pesos(adicionales)}` : ''}${c.deleted_at ? ' · ANULADA' : ''}`);
    if (Math.abs(sumaItems - num(c.total)) > 1) console.log(`    ¡Ojo! los ítems suman ${pesos(sumaItems)}, distinto del total`);
    for (const i of its) console.log(`    ${i.producto_nombre ?? i.producto_id}${i.variante_id ? ' (variante)' : ''} × ${num(i.cantidad)} a ${pesos(num(i.costo_unitario))}`);
  }
  if (sinVariante.length) {
    console.log(`\nAviso: ${sinVariante.length} ítem(s) de productos con variantes vienen sin variante en el legacy; su stock entra "sin variante":`);
    for (const i of sinVariante) console.log(`  ${i.producto_nombre ?? i.producto_id} × ${num(i.cantidad)}`);
  }

  if (!APLICAR) {
    console.log('\nModo prueba: no se copió nada. Agregá --aplicar para copiar.');
  } else {
    const columnas = async (tabla) => new Set((await db.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`, [tabla])).rows.map((r) => r.column_name));
    const colsCompras = await columnas('compras');
    const colsItems = await columnas('compras_items');
    const insertar = async (tabla, cols, f) => {
      const pares = Object.entries(f).filter(([k, v]) => cols.has(k) && v !== null && v !== undefined);
      const sql = `INSERT INTO "${tabla}" (${pares.map(([k]) => `"${k}"`).join(', ')}) VALUES (${pares.map((_, i) => `$${i + 1}`).join(', ')}) ON CONFLICT (id) DO NOTHING`;
      return (await db.query(sql, pares.map(([, v]) => (typeof v === 'object' ? JSON.stringify(v) : v)))).rowCount;
    };
    const stockDe = async (productoId, varianteId) => Number((await db.query(
      `SELECT COALESCE(SUM(cantidad * signo), 0) AS s FROM movimientos_inventario WHERE empresa_id = $1 AND deleted_at IS NULL AND producto_id = $2 AND ${varianteId ? 'variante_id = $3' : 'variante_id IS NULL'}`,
      varianteId ? [EMPRESA, productoId, varianteId] : [EMPRESA, productoId],
    )).rows[0].s);

    await db.query('BEGIN');
    const colsProductos = await columnas('productos');
    let np = 0;
    for (const p of productosNuevos) np += await insertar('productos', colsProductos, p);
    if (np) console.log(`Productos agregados: ${np}`);
    let nc = 0, ni = 0, nm = 0;
    for (const c of compras) {
      const its = itemsDe(c.id);
      const adicionales = num(c.costo_flete) + num(c.costo_impuestos) + num(c.costo_otros);
      // En el legacy total_costos_adicionales era GENERATED y total_real no se guardaba.
      const insertada = await insertar('compras', colsCompras, { ...c, total_costos_adicionales: adicionales, total_real: num(c.total) + adicionales });
      if (!insertada) continue; // ya estaba: no tocar stock ni costo
      nc += 1;
      for (const i of its) ni += await insertar('compras_items', colsItems, { ...i, empresa_id: i.empresa_id ?? EMPRESA, subtotal: num(i.cantidad) * num(i.costo_unitario) });
      if (c.deleted_at) continue; // anulada: sin stock ni costo

      const entrada = its.map((i) => ({ cantidad: num(i.cantidad), costoUnitario: num(i.costo_unitario) }));
      const reales = costoUnitarioConAdicionales(entrada, adicionales);
      // PPP antes de sumar el stock (agrupando producto/variante repetidos).
      const grupos = new Map();
      its.forEach((i, idx) => {
        const clave = `${i.producto_id}:${i.variante_id ?? ''}`;
        const g = grupos.get(clave) ?? { productoId: i.producto_id, varianteId: i.variante_id ?? null, cantidad: 0, valor: 0 };
        g.cantidad += num(i.cantidad);
        g.valor += num(i.cantidad) * reales[idx];
        grupos.set(clave, g);
      });
      for (const g of grupos.values()) {
        if (g.cantidad <= 0) continue;
        const costoNuevo = redondear(g.valor / g.cantidad);
        const stock = await stockDe(g.productoId, g.varianteId);
        const p = (await db.query('SELECT costo, precio_venta FROM productos WHERE id = $1', [g.productoId])).rows[0];
        const v = g.varianteId ? (await db.query('SELECT costo, precio_venta FROM producto_variantes WHERE id = $1', [g.varianteId])).rows[0] : null;
        const costoPrevio = v?.costo != null ? Number(v.costo) : p.costo != null ? Number(p.costo) : null;
        const costo = costoPromedioPonderado(stock, costoPrevio, g.cantidad, costoNuevo);
        if (v) await db.query('UPDATE producto_variantes SET costo = $1 WHERE id = $2', [costo, g.varianteId]);
        else await db.query('UPDATE productos SET costo = $1 WHERE id = $2', [costo, g.productoId]);
        await db.query(
          'INSERT INTO precios_historial (id, empresa_id, producto_id, variante, precio_venta, costo, fecha_desde) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)',
          [EMPRESA, g.productoId, g.varianteId, Number(v?.precio_venta ?? p.precio_venta ?? 0), costo, c.fecha],
        );
        console.log(`  costo ${its.find((i) => i.producto_id === g.productoId)?.producto_nombre ?? g.productoId}: ${costoPrevio == null ? '—' : pesos(costoPrevio)} → ${pesos(costo)} (stock previo ${stock})`);
      }
      // Entrada de stock: una por ítem, con el costo real, como ComprasRepository.crear.
      for (const [idx, i] of its.entries()) {
        const original = movimientos.find((m) => m.producto_id === i.producto_id && (m.variante_id ?? null) === (i.variante_id ?? null) && num(m.cantidad) === num(i.cantidad));
        await db.query(
          `INSERT INTO movimientos_inventario (id, empresa_id, producto_id, variante_id, usuario_id, tipo, cantidad, signo, costo_unitario, referencia_id, fecha, ubicacion_destino)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, 'compra', $5, 1, $6, $7, $8, $9)`,
          [EMPRESA, i.producto_id, i.variante_id ?? null, c.usuario_id, num(i.cantidad), reales[idx], c.id, original?.fecha ?? c.created_at ?? c.fecha, original?.ubicacion_destino ?? null],
        );
        nm += 1;
      }
    }
    await db.query('COMMIT');
    console.log(`\nCopiado: ${nc} compras, ${ni} ítems, ${nm} entradas de stock.`);
  }
} catch (e) {
  await db.query('ROLLBACK').catch(() => {});
  console.error('ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await db.end();
}

// Calidad de datos: reglas de negocio que los datos tienen que cumplir siempre,
// y la integridad de la bitácora de auditoría (cadena de hashes).
import { aceptado, control, sqlJson } from './comun.mjs';

/**
 * Cada chequeo cuenta filas que rompen una regla. `grave` = rojo si aparece alguna;
 * si no, amarillo. La consulta devuelve filas con { empresa, detalle }.
 */
const CHEQUEOS = [
  {
    id: 'stock-negativo',
    titulo: 'Stock negativo',
    grave: true,
    sql: `SELECT e.nombre AS empresa, p.nombre || coalesce(' / ' || v.sku, '') || ': ' || sum(m.cantidad*m.signo) AS detalle
      FROM movimientos_inventario m JOIN productos p ON p.id = m.producto_id JOIN empresas e ON e.id = m.empresa_id LEFT JOIN producto_variantes v ON v.id = m.variante_id
      WHERE m.deleted_at IS NULL AND p.deleted_at IS NULL GROUP BY e.nombre, p.nombre, v.sku HAVING sum(m.cantidad*m.signo) < 0`,
  },
  {
    id: 'ventas-sin-items',
    titulo: 'Ventas sin productos',
    grave: true,
    sql: `SELECT e.nombre AS empresa, coalesce(v.numero_venta, v.id::text) AS detalle FROM ventas v JOIN empresas e ON e.id = v.empresa_id
      WHERE v.deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM ventas_items i WHERE i.venta_id = v.id)`,
  },
  {
    id: 'totales-no-cuadran',
    titulo: 'Ventas cuyo total no coincide con sus productos menos el descuento',
    grave: true,
    sql: `SELECT e.nombre AS empresa, v.numero_venta || ': total ' || v.total_sin_interes || ' vs ' || (s.suma - coalesce(v.descuento,0)) AS detalle
      FROM ventas v JOIN empresas e ON e.id = v.empresa_id
      JOIN LATERAL (SELECT coalesce(sum(i.cantidad*i.precio_unitario),0) AS suma FROM ventas_items i WHERE i.venta_id = v.id) s ON true
      WHERE v.deleted_at IS NULL AND abs(coalesce(v.total_sin_interes,0) - (s.suma - coalesce(v.descuento,0))) > 1`,
  },
  {
    id: 'numeracion-duplicada',
    titulo: 'Números de venta repetidos',
    grave: true,
    sql: `SELECT e.nombre AS empresa, v.numero_venta || ' (' || count(*) || ' veces)' AS detalle FROM ventas v JOIN empresas e ON e.id = v.empresa_id
      WHERE v.numero_venta IS NOT NULL GROUP BY e.nombre, v.numero_venta HAVING count(*) > 1`,
  },
  {
    id: 'cruce-empresas',
    titulo: 'Datos que apuntan a productos de otra empresa',
    grave: true,
    sql: `SELECT e.nombre AS empresa, 'venta ' || coalesce(v.numero_venta,'?') || ' → ' || p.nombre || ' de ' || pe.nombre AS detalle
      FROM ventas_items i JOIN ventas v ON v.id = i.venta_id JOIN productos p ON p.id = i.producto_id JOIN empresas e ON e.id = v.empresa_id JOIN empresas pe ON pe.id = p.empresa_id
      WHERE p.empresa_id <> v.empresa_id
      UNION ALL
      SELECT e.nombre, 'movimiento ' || m.tipo || ' → ' || p.nombre || ' de ' || pe.nombre
      FROM movimientos_inventario m JOIN productos p ON p.id = m.producto_id JOIN empresas e ON e.id = m.empresa_id JOIN empresas pe ON pe.id = p.empresa_id
      WHERE p.empresa_id <> m.empresa_id`,
  },
  {
    id: 'fechas-futuras',
    titulo: 'Ventas o compras con fecha futura',
    grave: true,
    sql: `SELECT e.nombre AS empresa, 'venta ' || coalesce(v.numero_venta,'?') || ' del ' || v.fecha::date AS detalle FROM ventas v JOIN empresas e ON e.id = v.empresa_id WHERE v.fecha > now() + interval '1 day'
      UNION ALL SELECT e.nombre, 'compra del ' || c.fecha::date FROM compras c JOIN empresas e ON e.id = c.empresa_id WHERE c.fecha > now() + interval '1 day'`,
  },
  {
    id: 'saldo-inconsistente',
    titulo: 'Saldo pendiente negativo o mayor que la venta',
    grave: false,
    sql: `SELECT e.nombre AS empresa, coalesce(v.numero_venta,'?') || ': saldo ' || v.saldo_pendiente || ', total ' || coalesce(v.total_con_interes, v.total_sin_interes) AS detalle
      FROM ventas v JOIN empresas e ON e.id = v.empresa_id
      WHERE v.deleted_at IS NULL AND (v.saldo_pendiente < 0 OR v.saldo_pendiente > coalesce(v.total_con_interes, v.total_sin_interes) + 1)`,
  },
  {
    id: 'costo-cero',
    titulo: 'Ventas vigentes sin costo (ni en la venta ni en el producto): el margen sale inflado',
    grave: false,
    // Analytics usa el costo del producto si el de la venta es 0, y no cuenta las ventas borradas:
    // solo infla el margen lo vigente que no tiene costo en ningún lado.
    sql: `SELECT e.nombre AS empresa, p.nombre || ': ' || count(*) || ' ítems' AS detalle
      FROM ventas_items i JOIN ventas v ON v.id = i.venta_id JOIN productos p ON p.id = i.producto_id JOIN empresas e ON e.id = i.empresa_id
      LEFT JOIN producto_variantes pv ON pv.id = i.variante_id
      WHERE v.deleted_at IS NULL AND coalesce(i.costo_unitario,0) = 0 AND coalesce(pv.costo, p.costo, 0) = 0
      GROUP BY e.nombre, p.nombre`,
  },
  {
    id: 'sin-precio',
    titulo: 'Productos activos sin precio de venta',
    grave: false,
    sql: `SELECT e.nombre AS empresa, p.nombre AS detalle FROM productos p JOIN empresas e ON e.id = p.empresa_id
      WHERE p.deleted_at IS NULL AND p.activo AND NOT p.es_insumo AND coalesce(p.precio_venta,0) = 0`,
  },
  {
    id: 'clientes-duplicados',
    titulo: 'Clientes repetidos (mismo teléfono o email)',
    grave: false,
    sql: `SELECT e.nombre AS empresa, coalesce(c.email, c.telefono) || ' (' || count(*) || ')' AS detalle FROM clientes c JOIN empresas e ON e.id = c.empresa_id
      WHERE c.deleted_at IS NULL AND coalesce(c.email, c.telefono, '') <> '' GROUP BY e.nombre, coalesce(c.email, c.telefono) HAVING count(*) > 1`,
  },
  {
    id: 'productos-duplicados',
    titulo: 'Productos con el mismo nombre',
    grave: false,
    sql: `SELECT e.nombre AS empresa, p.nombre || ' (' || count(*) || ')' AS detalle FROM productos p JOIN empresas e ON e.id = p.empresa_id
      WHERE p.deleted_at IS NULL GROUP BY e.nombre, lower(trim(p.nombre)), p.nombre HAVING count(*) > 1`,
  },
];

export async function calidadDatos() {
  const filas = [];
  let estado = 'verde';
  let problemas = 0;
  for (const c of CHEQUEOS) {
    let r;
    try {
      r = await sqlJson(`SELECT json_build_object('n', count(*), 'ejemplos', coalesce(json_agg(x) FILTER (WHERE x.rn <= 5), '[]')) FROM (SELECT q.*, row_number() OVER () AS rn FROM (${c.sql}) q WHERE q.empresa NOT IN (SELECT nombre FROM empresas WHERE es_demo)) x`);
    } catch (e) {
      filas.push(`⚪ ${c.titulo}: no se pudo revisar (${e.message.slice(0, 120)})`);
      estado = estado === 'verde' ? 'amarillo' : estado;
      continue;
    }
    if (r.n === 0) {
      filas.push(`✅ ${c.titulo}: ninguno`);
      continue;
    }
    const ok = aceptado('datos', c.id);
    problemas += ok ? 0 : r.n;
    const color = ok ? 'amarillo' : c.grave ? 'rojo' : 'amarillo';
    estado = estado === 'rojo' || color === 'rojo' ? 'rojo' : 'amarillo';
    const ejemplos = r.ejemplos.map((x) => `${x.empresa}: ${x.detalle}`).join('; ');
    filas.push(`${color === 'rojo' ? '🔴' : '🟡'} ${c.titulo}: ${r.n}${ok ? ` (aceptado: ${ok.motivo})` : ''}. Ej.: ${ejemplos}`);
  }
  return control({
    id: 'DAT-01',
    titulo: 'Calidad de datos (reglas de negocio)',
    estado,
    resumen: `${CHEQUEOS.length} reglas revisadas (sin empresas demo), ${filas.filter((f) => f.startsWith('✅')).length} sin problemas; ${problemas} filas con problemas.`,
    detalle: filas,
    normas: ['soc2-pi1.2', 'gdpr-5.1d'],
  });
}

export async function integridadBitacora() {
  const base = { id: 'AUD-01', titulo: 'Bitácora de auditoría íntegra (cadena de hashes)', normas: ['soc2-cc7.2', 'soc2-cc4.1', 'iso-a8.15', 'asvs-v7'] };
  try {
    const r = await sqlJson(`WITH c AS (
        SELECT r.id, r.hash, encode(sha256(convert_to(coalesce(lag(r.hash) OVER (ORDER BY r.id), 'genesis') || '|' || registro_auditoria_contenido(r), 'UTF8')), 'hex') AS esperado
        FROM registro_auditoria r)
      SELECT json_build_object('total', count(*), 'errores', count(*) FILTER (WHERE hash <> esperado), 'primer', min(id) FILTER (WHERE hash <> esperado),
        'ultimo', (SELECT json_build_object('id', id, 'hash', hash, 'fecha', creado_en) FROM registro_auditoria ORDER BY id DESC LIMIT 1),
        'triggers', (SELECT count(*) FROM pg_trigger WHERE tgrelid = 'registro_auditoria'::regclass AND NOT tgisinternal AND tgenabled <> 'D')) FROM c`);
    const triggersOk = r.triggers >= 3;
    return control({
      ...base,
      estado: r.errores > 0 || !triggersOk ? 'rojo' : 'verde',
      resumen:
        r.errores > 0
          ? `¡ALTERADA! ${r.errores} registros no coinciden; el primero es el #${r.primer}.`
          : `${r.total} registros encadenados, ninguno alterado. ${triggersOk ? 'Protección contra edición y borrado activa.' : 'ATENCIÓN: hay triggers de protección desactivados.'}`,
      detalle: r.ultimo ? [`Sello (ancla) para guardar fuera del sistema: #${r.ultimo.id} ${r.ultimo.hash}`] : [],
      evidencia: r.ultimo,
    });
  } catch (e) {
    return control({ ...base, estado: 'gris', resumen: `No se pudo verificar: ${e.message.slice(0, 150)}` });
  }
}

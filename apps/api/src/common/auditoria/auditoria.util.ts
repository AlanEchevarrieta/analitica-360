/**
 * Bitácora de auditoría: qué se registra de cada tabla y cómo se escribe.
 * Puro (sin base ni Nest) para poder testearlo.
 */

export type Accion = 'crear' | 'editar' | 'borrar' | 'restaurar' | 'anular';
export type Fila = Record<string, unknown>;
/** campo → [antes, después] */
export type Cambios = Record<string, [unknown, unknown]>;

interface ConfigEntidad {
  /** "producto", "venta"… (en minúscula: va en medio de una frase). */
  nombre: string;
  /** De dónde sacar cómo se llama la fila ("Mochila", "V-000640"). */
  campoNombre: string[];
  /** Solo registrar algunas filas (ej. movimientos de stock manuales, no los de cada venta). */
  filtro?: (fila: Fila) => boolean;
  /** Crear una fila de esta tabla es en realidad otra acción (crear una Anulación = anular). */
  accionAlCrear?: Accion;
}

const MOVIMIENTOS_MANUALES = new Set(['ajuste_positivo', 'ajuste_negativo', 'merma', 'rotura', 'perdida', 'consumo_interno', 'transferencia']);

/** Tablas auditadas (nombre del modelo de Prisma). El resto no se registra. */
export const AUDITADOS: Record<string, ConfigEntidad> = {
  Empresa: { nombre: 'empresa', campoNombre: ['nombre'] },
  Usuario: { nombre: 'usuario', campoNombre: ['nombre', 'email'] },
  ColaboradorPermiso: { nombre: 'permisos de colaborador', campoNombre: [] },
  InvitacionColaborador: { nombre: 'invitación', campoNombre: ['email'] },
  ConfiguracionEmpresa: { nombre: 'configuración', campoNombre: [] },
  Producto: { nombre: 'producto', campoNombre: ['nombre'] },
  ProductoVariante: { nombre: 'variante', campoNombre: ['sku'] },
  Categoria: { nombre: 'categoría', campoNombre: ['nombre'] },
  ListaPrecio: { nombre: 'lista de precios', campoNombre: ['nombre'] },
  Ubicacion: { nombre: 'ubicación', campoNombre: ['nombre'] },
  Cliente: { nombre: 'cliente', campoNombre: ['nombre'] },
  Proveedor: { nombre: 'proveedor', campoNombre: ['nombre'] },
  Venta: { nombre: 'venta', campoNombre: ['numeroVenta'] },
  Anulacion: { nombre: 'venta', campoNombre: ['ventaId'], accionAlCrear: 'anular' },
  Devolucion: { nombre: 'devolución', campoNombre: ['numero'] },
  Compra: { nombre: 'compra', campoNombre: ['proveedorNombre'] },
  OrdenCompra: { nombre: 'orden de compra', campoNombre: ['numero'] },
  Pedido: { nombre: 'pedido', campoNombre: ['numeroPedido'] },
  CobroCliente: { nombre: 'cobro a cliente', campoNombre: [] },
  Gasto: { nombre: 'gasto', campoNombre: ['descripcion'] },
  MovimientoFinanciero: { nombre: 'movimiento de caja', campoNombre: ['descripcion', 'concepto'] },
  MovimientoInventario: { nombre: 'movimiento de stock', campoNombre: ['tipo'], filtro: (f) => MOVIMIENTOS_MANUALES.has(String(f.tipo)) },
  Receta: { nombre: 'receta', campoNombre: ['nombre'] },
  OrdenProduccion: { nombre: 'orden de producción', campoNombre: ['numero'] },
  TiendaConfig: { nombre: 'tienda online', campoNombre: ['subdominio'] },
  Suscripcion: { nombre: 'suscripción', campoNombre: ['estado'] },
  Pago: { nombre: 'pago', campoNombre: ['periodo'] },
  CuotaProgramada: { nombre: 'cuota', campoNombre: ['numero'] },
  Camara: { nombre: 'cámara', campoNombre: ['nombre'] },
  Cupon: { nombre: 'cupón', campoNombre: ['codigo'] },
  Liquidacion: { nombre: 'liquidación', campoNombre: ['periodo'] },
};

/** No aportan nada a la bitácora. */
const IGNORADOS = new Set(['id', 'empresaId', 'createdAt', 'updatedAt', 'creadoEn']);
/** Nunca se guarda su valor, solo que cambió. */
const SECRETO = /token|secret|password|contrase|clave|apikey|api_key/i;

const ETIQUETAS: Record<string, string> = {
  precioVenta: 'precio de venta',
  categoria: 'categoría',
  costo: 'costo',
  deletedAt: 'borrado',
  activo: 'activo',
  nombre: 'nombre',
  rolCrudo: 'rol',
  codigoBarra: 'código de barras',
  saldoPendiente: 'saldo pendiente',
  estadoCobro: 'estado de cobro',
  formaPago: 'forma de pago',
  stockMinimo: 'stock mínimo',
  fechaVencimiento: 'vencimiento',
};

/** precioVenta → "precio venta" si no tiene nombre propio. */
export function etiquetaCampo(campo: string): string {
  return ETIQUETAS[campo] ?? campo.replace(/Id$/, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase();
}

/** Valor comparable y guardable en JSON (Decimal, Date, BigInt). */
export function normalizar(v: unknown): unknown {
  if (v === undefined || v === null) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'bigint') return v.toString();
  if (typeof v === 'object' && v !== null && 'toNumber' in v && typeof (v as { toNumber: unknown }).toNumber === 'function') return (v as { toNumber: () => number }).toNumber();
  if (Array.isArray(v) || typeof v === 'object') return JSON.parse(JSON.stringify(v));
  return v;
}

const escalar = (v: unknown) => v === null || v === undefined || typeof v !== 'object' || v instanceof Date || (typeof v === 'object' && 'toNumber' in (v as object));

/** Diferencias campo por campo entre dos versiones de una fila (solo campos simples presentes en las dos). */
export function diferencias(antes: Fila | null, despues: Fila | null): Cambios {
  const cambios: Cambios = {};
  const claves = new Set([...Object.keys(antes ?? {}), ...Object.keys(despues ?? {})]);
  for (const k of claves) {
    if (IGNORADOS.has(k)) continue;
    const a = antes?.[k];
    const d = despues?.[k];
    if (antes && despues && !(k in despues)) continue; // el resultado no trajo ese campo (select parcial)
    if (antes && despues && !(k in antes)) continue; // relación incluida en el resultado (include): no es un campo de la fila
    if (!escalar(a) || !escalar(d)) {
      if (JSON.stringify(normalizar(a)) === JSON.stringify(normalizar(d))) continue;
      if (typeof a === 'object' && a !== null && !Array.isArray(a) && !(a instanceof Date) && 'id' in a) continue; // relación incluida
    }
    const na = normalizar(a);
    const nd = normalizar(d);
    if (JSON.stringify(na) === JSON.stringify(nd)) continue;
    cambios[k] = SECRETO.test(k) ? ['•••', '•••'] : [na, nd];
  }
  return cambios;
}

/** Aplica el data de un update a la fila (para updateMany, donde no hay resultado por fila). */
export function aplicarData(fila: Fila, data: Fila): Fila {
  const nueva: Fila = { ...fila };
  for (const [k, v] of Object.entries(data ?? {})) {
    if (v !== null && typeof v === 'object' && !(v instanceof Date) && !('toNumber' in v)) {
      const op = v as Record<string, unknown>;
      const actual = Number(normalizar(fila[k]) ?? 0);
      if ('set' in op) nueva[k] = op.set;
      else if ('increment' in op) nueva[k] = actual + Number(op.increment);
      else if ('decrement' in op) nueva[k] = actual - Number(op.decrement);
      else if ('multiply' in op) nueva[k] = actual * Number(op.multiply);
      else if ('divide' in op) nueva[k] = actual / Number(op.divide);
      continue; // relaciones (connect, create…): no son campos de la fila
    }
    nueva[k] = v;
  }
  return nueva;
}

/** editar → borrar/restaurar si lo que cambió es deletedAt. */
export function accionDeEdicion(cambios: Cambios): Accion {
  const borrado = cambios.deletedAt;
  if (borrado) return borrado[1] ? 'borrar' : 'restaurar';
  return 'editar';
}

export function nombreDeFila(modelo: string, fila: Fila | null): string | null {
  const conf = AUDITADOS[modelo];
  if (!conf || !fila) return null;
  for (const c of conf.campoNombre) {
    const v = fila[c];
    if (v !== null && v !== undefined && String(v).trim()) return String(normalizar(v)).slice(0, 120);
  }
  return null;
}

const VERBO: Record<Accion, string> = { crear: 'creó', editar: 'editó', borrar: 'borró', restaurar: 'restauró', anular: 'anuló' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const valorLegible = (campo: string, v: unknown): string => {
  if (v === null || v === undefined || v === '') return '(vacío)';
  if (typeof v === 'string' && UUID.test(v)) return `…${v.slice(-6)}`;
  if (typeof v === 'boolean') return v ? 'sí' : 'no';
  if (typeof v === 'number' && /precio|costo|monto|total|saldo|importe/i.test(campo)) return `$${v.toLocaleString('es-AR')}`;
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return s.length > 40 ? `${s.slice(0, 40)}…` : s;
};

/** "editó el producto «Mochila»: precio de venta $12.200 → $13.000" */
export function resumen(modelo: string, accion: Accion, nombre: string | null, cambios: Cambios): string {
  const entidad = AUDITADOS[modelo]?.nombre ?? modelo;
  const base = `${VERBO[accion]} ${entidad}${nombre ? ` «${nombre}»` : ''}`;
  if (accion !== 'editar') return base;
  // Si cambian el texto y su id (categoria + categoriaId), en la frase alcanza con el texto.
  const partes = Object.entries(cambios)
    .filter(([k]) => !(k.endsWith('Id') && k.slice(0, -2) in cambios))
    .slice(0, 3)
    .map(([k, [a, d]]) => `${etiquetaCampo(k)} ${valorLegible(k, a)} → ${valorLegible(k, d)}`);
  const resto = Object.keys(cambios).filter((k) => !(k.endsWith('Id') && k.slice(0, -2) in cambios)).length - partes.length;
  return `${base}: ${partes.join('; ')}${resto > 0 ? ` y ${resto} cambio${resto === 1 ? '' : 's'} más` : ''}`;
}

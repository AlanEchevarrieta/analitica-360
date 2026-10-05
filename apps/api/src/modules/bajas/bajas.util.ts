/**
 * Baja de una cuenta completa a pedido del dueño (Ley 25.326, derecho de supresión).
 * Reglas puras: plazos y el orden en que se borran las tablas.
 */

/** Días para arrepentirse: la cuenta queda bloqueada (solo lectura, puede exportar) y después se borra. */
export const DIAS_PARA_ARREPENTIRSE = 30;

/**
 * Tablas con datos de la empresa que NO se borran:
 * - nuestros cobros y su historia (pagos, cuotas, comisiones, suscripciones, planes, cambios de origen),
 * - la constancia de que aceptó los términos,
 * - los usos de cupones (para que la prueba gratis siga siendo de un solo uso),
 * - la bitácora (queda con los datos personales tapados).
 */
export const TABLAS_QUE_SE_CONSERVAN = new Set([
  'pagos',
  'cuotas_programadas',
  'comisiones',
  'suscripciones',
  'historial_planes',
  'cambios_origen',
  'aceptaciones_terminos',
  'cupones_usos',
  'registro_auditoria',
]);

export interface Dependencia {
  /** Tabla que referencia (hija) y su columna. */
  hija: string;
  columna: string;
  /** Tabla referenciada (madre) y su columna. */
  madre: string;
  columnaMadre: string;
}

/**
 * Orden de borrado: primero las tablas que nadie más (de las que se borran) referencia.
 * Las referencias de una tabla a sí misma no cuentan (se borran todas sus filas juntas).
 */
export function ordenDeBorrado(tablas: string[], dependencias: Dependencia[]): string[] {
  const conjunto = new Set(tablas);
  // Cuántas tablas del conjunto (distintas) referencian a cada una.
  const referidaPor = new Map<string, Set<string>>(tablas.map((t) => [t, new Set()]));
  for (const d of dependencias) {
    if (d.hija !== d.madre && conjunto.has(d.hija) && conjunto.has(d.madre)) referidaPor.get(d.madre)!.add(d.hija);
  }
  const orden: string[] = [];
  const pendientes = new Set(tablas);
  while (pendientes.size) {
    const libres = [...pendientes].filter((t) => [...referidaPor.get(t)!].every((h) => !pendientes.has(h))).sort();
    if (!libres.length) throw new Error(`Hay un ciclo de referencias entre: ${[...pendientes].sort().join(', ')}`);
    for (const t of libres) {
      orden.push(t);
      pendientes.delete(t);
    }
  }
  return orden;
}

/** AAAA-MM-DD + días. */
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Para confirmar: el nombre del negocio, sin importar mayúsculas, tildes ni espacios de más. */
export function mismoNombre(a: string, b: string): boolean {
  const n = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  return n(a) !== '' && n(a) === n(b);
}

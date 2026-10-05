// Sellos de la bitácora guardados FUERA del sistema (una nota de Obsidian).
//
// La cadena de hashes detecta si alguien toca una fila, pero no si alguien con acceso a
// la base reescribe la bitácora entera y recalcula todos los hashes. Para eso sirve un
// ancla externa: el último hash de cada auditoría queda anotado afuera, y la auditoría
// siguiente comprueba que esas filas sigan teniendo el mismo hash.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const ARCHIVO_SELLOS =
  process.env.SELLOS_BITACORA ?? path.join(process.env.OBSIDIAN_DIR ?? path.join(os.homedir(), 'Documents', 'Alan', 'Analítica 360', 'Auditorías'), 'Sellos de la bitácora.md');

const ENCABEZADO = `# Sellos de la bitácora

Cada auditoría (\`pnpm auditar\`) agrega acá el último registro de la bitácora y su hash.
La siguiente auditoría comprueba que esos registros sigan teniendo el mismo hash: si alguien
reescribiera la bitácora entera dentro de la base, no coincidirían.

**No editar ni borrar filas.** Para más seguridad, copiá cada tanto esta nota a otro lugar
(email, Drive o impresa).

| Fecha | Registro | Hash |
|---|---|---|
`;

/** Los sellos anotados: [{ fecha, id, hash }]. */
export function leerSellos(archivo = ARCHIVO_SELLOS) {
  let texto = '';
  try {
    texto = fs.readFileSync(archivo, 'utf8');
  } catch {
    return [];
  }
  return [...texto.matchAll(/^\|\s*([^|]+?)\s*\|\s*#(\d+)\s*\|\s*`?([0-9a-f]{64})`?\s*\|/gm)].map((m) => ({ fecha: m[1], id: Number(m[2]), hash: m[3] }));
}

/** Agrega un sello (si es nuevo). Devuelve true si lo escribió. */
export function anotarSello(sello, archivo = ARCHIVO_SELLOS) {
  const previos = leerSellos(archivo);
  if (previos.some((s) => s.id === sello.id)) return false;
  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  if (!fs.existsSync(archivo)) fs.writeFileSync(archivo, ENCABEZADO);
  fs.appendFileSync(archivo, `| ${sello.fecha} | #${sello.id} | \`${sello.hash}\` |\n`);
  return true;
}

/**
 * Compara los sellos anotados con lo que hay hoy en la base.
 * `hashesActuales`: { [id]: hash | null } de esas filas (null = la fila ya no existe).
 */
export function compararSellos(sellos, hashesActuales) {
  const distintos = sellos.filter((s) => hashesActuales[s.id] !== s.hash);
  return { revisados: sellos.length, distintos };
}

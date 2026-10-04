// Piezas comunes de las auditorías: correr comandos, Docker, la base y el semáforo.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

export const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..');
export const POSTGRES = process.env.AUDITORIA_POSTGRES ?? 'analitica-360-postgres-1';
export const WEB = process.env.WEB_URL ?? 'http://localhost:3000';
export const API = process.env.API_URL ?? 'http://localhost:3001';
export const TIENDA = process.env.TIENDA_URL ?? 'http://localhost:3010';
/** Desde un contenedor, la compu es host.docker.internal. */
export const desdeDocker = (url) => url.replace('localhost', 'host.docker.internal').replace('127.0.0.1', 'host.docker.internal');
/** Ruta del disco que entiende `docker -v` (C:/Users/... en Windows). */
export const rutaDocker = (p) => path.resolve(p).replace(/\\/g, '/');

/** Corre un comando y devuelve { codigo, salida, error, ms }. Nunca tira: la auditoría sigue. */
export function correr(cmd, args, { entrada, timeoutMs = 30 * 60_000, env } = {}) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    // En Windows pnpm es un .cmd y Node 24 no lo ejecuta sin shell (los argumentos son nuestros, sin datos de afuera).
    const conShell = process.platform === 'win32' && cmd === 'pnpm';
    const opciones = { cwd: RAIZ, env: { ...process.env, ...env }, windowsHide: true };
    const p = conShell ? spawn(`pnpm ${args.join(' ')}`, { ...opciones, shell: true }) : spawn(cmd, args, opciones);
    let salida = '';
    let error = '';
    p.stdout.on('data', (d) => (salida += d));
    p.stderr.on('data', (d) => (error += d));
    const reloj = setTimeout(() => p.kill('SIGKILL'), timeoutMs);
    if (entrada) entrada.pipe(p.stdin);
    else p.stdin.end();
    p.on('error', (e) => {
      clearTimeout(reloj);
      resolve({ codigo: -1, salida, error: String(e), ms: Date.now() - t0 });
    });
    p.on('close', (codigo) => {
      clearTimeout(reloj);
      resolve({ codigo, salida, error, ms: Date.now() - t0 });
    });
  });
}

/** SQL contra el Postgres de desarrollo; la consulta tiene que devolver un único JSON. */
export async function sqlJson(sql, contenedor = POSTGRES) {
  const r = await correr('docker', ['exec', '-i', contenedor, 'sh', '-c', 'psql -X -q -A -t -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'], {
    entrada: textoComoStream(sql),
  });
  if (r.codigo !== 0) throw new Error(r.error.trim() || `psql salió con ${r.codigo}`);
  return JSON.parse(r.salida.trim() || 'null');
}

/** Texto como stream, para pasarlo por stdin a un proceso. */
export const textoComoStream = (texto) => Readable.from([Buffer.from(texto)]);

/** Lee un JSON que puede no existir. */
export const leerJson = (archivo, porDefecto = null) => {
  try {
    return JSON.parse(fs.readFileSync(archivo, 'utf8'));
  } catch {
    return porDefecto;
  }
};

// ---------- Semáforo ----------
/** verde = bien, amarillo = mirar (o aceptado), rojo = corregir, gris = no se pudo correr. */
export const COLOR = { verde: '🟢', amarillo: '🟡', rojo: '🔴', gris: '⚪' };
const ORDEN = ['gris', 'verde', 'amarillo', 'rojo'];
export const peor = (...estados) => estados.reduce((a, b) => (ORDEN.indexOf(b) > ORDEN.indexOf(a) ? b : a), 'verde');

/**
 * Resultado de un control: { id, titulo, estado, resumen, detalle[], evidencia, normas[] }.
 * normas: claves de la matriz de cumplimiento que este control respalda.
 */
export const control = (c) => ({ detalle: [], normas: [], ...c });

// ---------- Riesgos aceptados ----------
const ACEPTADOS = leerJson(path.join(RAIZ, 'scripts/auditoria/riesgos-aceptados.json'), []);
/** ¿Este hallazgo ya fue evaluado y aceptado? Devuelve la entrada (con su motivo) o null. */
export function aceptado(herramienta, regla, ruta = '') {
  const hoy = new Date().toISOString().slice(0, 10);
  return (
    ACEPTADOS.find(
      (a) =>
        a.herramienta === herramienta &&
        (a.regla === '*' || regla.includes(a.regla)) &&
        (!a.ruta || ruta.replace(/\\/g, '/').includes(a.ruta)) &&
        (!a.revisar || a.revisar >= hoy), // vencido = hay que volver a evaluarlo
    ) ?? null
  );
}

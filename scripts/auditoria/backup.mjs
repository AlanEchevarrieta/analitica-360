// Simulacro de backup y restauración: se saca un backup de la base, se
// restaura en un Postgres nuevo y descartable, y se compara tabla por tabla.
// Mide cuánto tarda volver a estar en pie (RTO) y verifica que la bitácora
// restaurada siga íntegra. No toca la base original.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { control, correr, POSTGRES, sqlJson } from './comun.mjs';

const SIMULACRO = 'a360-simulacro-restauracion';
const CONTAR = `SELECT json_object_agg(t, n) FROM (
  SELECT c.relname AS t, (xpath('/row/n/text()', query_to_xml(format('SELECT count(*) AS n FROM %I', c.relname), false, true, '')))[1]::text::bigint AS n
  FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace WHERE s.nspname = 'public' AND c.relkind = 'r') x`;

export async function simulacroBackup(dir) {
  const base = { id: 'BCK-01', titulo: 'Simulacro de backup y restauración', normas: ['soc2-a1.2', 'soc2-a1.3', 'iso-a8.13', 'iso-a5.30'] };
  const archivo = path.join(dir, 'backup.dump');
  try {
    // 1. Backup (formato custom de pg_dump, comprimido).
    const t0 = Date.now();
    const dump = await correr('docker', ['exec', POSTGRES, 'sh', '-c', 'pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /tmp/simulacro.dump']);
    if (dump.codigo !== 0) throw new Error(`pg_dump: ${dump.error.slice(0, 200)}`);
    await correr('docker', ['cp', `${POSTGRES}:/tmp/simulacro.dump`, archivo]);
    await correr('docker', ['exec', POSTGRES, 'rm', '-f', '/tmp/simulacro.dump']);
    const msBackup = Date.now() - t0;
    const bytes = fs.statSync(archivo).size;
    const sha = crypto.createHash('sha256').update(fs.readFileSync(archivo)).digest('hex');

    // 2. Restauración en un Postgres nuevo (como si el servidor se hubiera perdido).
    const t1 = Date.now();
    await correr('docker', ['rm', '-f', SIMULACRO]);
    const arranque = await correr('docker', ['run', '-d', '--name', SIMULACRO, '-e', 'POSTGRES_PASSWORD=simulacro', '-e', 'POSTGRES_DB=restaurada', 'postgres:16']);
    if (arranque.codigo !== 0) throw new Error(`no arrancó el Postgres de prueba: ${arranque.error.slice(0, 200)}`);
    for (let i = 0; i < 60; i++) {
      const listo = await correr('docker', ['exec', SIMULACRO, 'pg_isready', '-U', 'postgres', '-d', 'restaurada']);
      if (listo.codigo === 0) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    await new Promise((r) => setTimeout(r, 1500));
    await correr('docker', ['cp', archivo, `${SIMULACRO}:/tmp/simulacro.dump`]);
    const restore = await correr('docker', ['exec', SIMULACRO, 'pg_restore', '--no-owner', '--no-acl', '-U', 'postgres', '-d', 'restaurada', '/tmp/simulacro.dump']);
    const msRestauracion = Date.now() - t1;

    // 3. Comparación tabla por tabla y bitácora íntegra en la copia.
    const [original, restaurada] = await Promise.all([
      sqlJson(CONTAR),
      correr('docker', ['exec', '-i', SIMULACRO, 'psql', '-X', '-q', '-A', '-t', '-U', 'postgres', '-d', 'restaurada', '-c', CONTAR]).then((r) => JSON.parse(r.salida.trim() || '{}')),
    ]);
    const tablas = Object.keys(original);
    const distintas = tablas.filter((t) => Number(original[t]) !== Number(restaurada[t] ?? -1));
    const cadena = await correr('docker', ['exec', '-i', SIMULACRO, 'psql', '-X', '-q', '-A', '-t', '-U', 'postgres', '-d', 'restaurada', '-c',
      `SELECT count(*) FILTER (WHERE hash <> esperado) FROM (SELECT hash, registro_auditoria_esperado(r, lag(hash) OVER (ORDER BY id)) AS esperado FROM registro_auditoria r) x`]);
    const erroresCadena = Number(cadena.salida.trim() || -1);
    const filas = tablas.reduce((a, t) => a + Number(original[t]), 0);

    const ok = distintas.length === 0 && erroresCadena === 0;
    return control({
      ...base,
      estado: ok ? (msRestauracion > 15 * 60_000 ? 'amarillo' : 'verde') : 'rojo',
      resumen: ok
        ? `Restauración completa y verificada: ${tablas.length} tablas y ${filas.toLocaleString('es-AR')} filas idénticas; la bitácora restaurada está íntegra. Volver a estar en pie tardó ${(msRestauracion / 1000).toFixed(0)} s.`
        : `La copia restaurada NO coincide: ${distintas.length} tablas distintas${erroresCadena ? ` y la bitácora no verifica (${erroresCadena})` : ''}.`,
      detalle: [
        `Backup: ${(bytes / 1024 / 1024).toFixed(1)} MB en ${(msBackup / 1000).toFixed(1)} s (sha256 ${sha.slice(0, 16)}…)`,
        `Restauración en un servidor nuevo (RTO medido): ${(msRestauracion / 1000).toFixed(1)} s${restore.codigo !== 0 ? ` (con avisos: ${restore.error.split('\n')[0].slice(0, 120)})` : ''}`,
        ...distintas.slice(0, 10).map((t) => `Distinta: ${t} original ${original[t]} vs restaurada ${restaurada[t] ?? 'falta'}`),
        'RPO: hoy depende de cada cuánto se haga el backup. En producción: diario como mínimo, guardado fuera del servidor (ver Pendientes).',
      ],
      evidencia: { bytes, sha, msBackup, msRestauracion, tablas: tablas.length, filas },
    });
  } catch (e) {
    return control({ ...base, estado: 'rojo', resumen: `El simulacro falló: ${e.message}` });
  } finally {
    await correr('docker', ['rm', '-f', SIMULACRO]);
    fs.rmSync(archivo, { force: true }); // tiene datos de clientes: no se deja tirado
  }
}

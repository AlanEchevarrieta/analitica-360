// Carga y rendimiento (k6): usuarios simultáneos navegando la app de una
// empresa real, solo con lecturas. Usa una sesión de Clerk de 10 minutos que
// se revoca al terminar.
import fs from 'node:fs';
import path from 'node:path';
import { API, control, correr, desdeDocker, leerJson, RAIZ, rutaDocker } from './comun.mjs';

const env = () =>
  Object.fromEntries(
    fs
      .readFileSync(path.join(RAIZ, 'apps/api/.env'), 'utf8')
      .split(/\r?\n/)
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]),
  );

async function sesionClerk(usuario) {
  const h = { Authorization: `Bearer ${env().CLERK_SECRET_KEY}`, 'Content-Type': 'application/json' };
  const s = await fetch('https://api.clerk.com/v1/sessions', { method: 'POST', headers: h, body: JSON.stringify({ user_id: usuario }) }).then((r) => r.json());
  if (!s.id) throw new Error(`Clerk no creó la sesión: ${JSON.stringify(s).slice(0, 200)}`);
  const t = await fetch(`https://api.clerk.com/v1/sessions/${s.id}/tokens`, { method: 'POST', headers: h, body: JSON.stringify({ expires_in_seconds: 600 }) }).then((r) => r.json());
  return { token: t.jwt, revocar: () => fetch(`https://api.clerk.com/v1/sessions/${s.id}/revoke`, { method: 'POST', headers: h }).catch(() => {}) };
}

/** Límites (p95 en ms) que tiene que cumplir cada nivel de carga. */
const NIVELES = [
  { usuarios: 30, nombre: 'uso normal', p95: 500 },
  { usuarios: 100, nombre: 'pico (estrés)', p95: 1500 },
];

export async function carga(dir, { usuario, rapido = false } = {}) {
  const base = { id: 'PERF-01', titulo: 'Carga y tiempos de respuesta (k6)', normas: ['soc2-a1.1', 'iso-a8.6'] };
  if (!usuario) return control({ ...base, estado: 'gris', resumen: 'Falta el usuario de prueba: AUDITORIA_USUARIO_CARGA o .auditorias/config.json (usuarioCarga).' });
  const filas = [];
  let estado = 'verde';
  for (const nivel of rapido ? NIVELES.slice(0, 1) : NIVELES) {
    let sesion;
    try {
      sesion = await sesionClerk(usuario);
    } catch (e) {
      return control({ ...base, estado: 'gris', resumen: e.message });
    }
    const archivo = `k6-${nivel.usuarios}.json`;
    await correr('docker', [
      'run', '--rm', '-v', `${rutaDocker(path.join(RAIZ, 'scripts/auditoria'))}:/s`, '-v', `${rutaDocker(dir)}:/out`,
      '-e', `API_URL=${desdeDocker(API)}`, '-e', `TOKEN=${sesion.token}`, '-e', `VUS=${nivel.usuarios}`, '-e', 'DURACION=40s', '-e', `SALIDA=/out/${archivo}`,
      'grafana/k6', 'run', '--quiet', '/s/carga.k6.js',
    ]);
    await sesion.revocar();
    const d = leerJson(path.join(dir, archivo));
    if (!d) {
      filas.push(`${nivel.usuarios} usuarios: no se pudo correr`);
      estado = 'gris';
      continue;
    }
    const m = d.metrics;
    const p95 = m.http_req_duration.values['p(95)'];
    const fallidos = m.http_req_failed.values.rate * 100;
    const lentas = Object.entries(m)
      .filter(([k]) => k.startsWith('http_req_duration{pantalla'))
      .map(([k, v]) => [k.slice(27, -1), v.values['p(95)']])
      .sort((a, b) => b[1] - a[1]);
    const ok = fallidos < 1 && p95 <= nivel.p95;
    if (!ok) estado = fallidos >= 1 ? 'rojo' : estado === 'rojo' ? 'rojo' : 'amarillo';
    filas.push(
      `${ok ? '✅' : '⚠️'} ${nivel.usuarios} usuarios (${nivel.nombre}): ${m.http_reqs.values.count} pedidos, ${m.http_reqs.values.rate.toFixed(0)}/s, errores ${fallidos.toFixed(2)} %, ` +
        `p95 ${p95.toFixed(0)} ms (límite ${nivel.p95}), p99 ${m.http_req_duration.values['p(99)'].toFixed(0)} ms. Lo más lento: ${lentas.slice(0, 3).map(([n, v]) => `${n} ${v.toFixed(0)} ms`).join(', ')}`,
    );
  }
  return control({ ...base, estado, resumen: filas[0] ?? 'Sin resultados', detalle: filas });
}

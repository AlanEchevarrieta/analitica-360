// Ataque simulado desde afuera (DAST) con OWASP ZAP en modo "baseline": recorre
// el sitio como un visitante y analiza las respuestas (cabeceras, cookies,
// fugas de información). No manda ataques destructivos: es seguro en producción.
import path from 'node:path';
import { aceptado, API, control, correr, desdeDocker, leerJson, RAIZ, rutaDocker, TIENDA, WEB } from './comun.mjs';

const RIESGO = ['informativo', 'bajo', 'medio', 'alto'];

export async function zap(dir, { minutos = 1 } = {}) {
  const objetivos = [
    ['web', `${WEB}/sign-in`],
    ['api', API],
    ['tienda', TIENDA],
    // Sitios extra de esta compu (ej. acacia-store): .auditorias/config.json → "sitiosExtra": [["nombre", "url"]]
    ...(leerJson(path.join(RAIZ, '.auditorias/config.json'), {}).sitiosExtra ?? []),
  ];
  const hallazgos = [];
  const sinCorrer = [];
  for (const [nombre, url] of objetivos) {
    const archivo = `zap-${nombre}.json`;
    await correr(
      'docker',
      ['run', '--rm', '-v', `${rutaDocker(dir)}:/zap/wrk:rw`, '-t', 'zaproxy/zap-stable', 'zap-baseline.py', '-t', desdeDocker(url), '-J', archivo, '-m', String(minutos), '-I'],
      { timeoutMs: 20 * 60_000 },
    );
    const datos = leerJson(path.join(dir, archivo));
    if (!datos) {
      sinCorrer.push(nombre);
      continue;
    }
    for (const sitio of datos.site ?? []) {
      for (const a of sitio.alerts ?? []) {
        const riesgo = Number(a.riskcode);
        if (riesgo === 0) continue;
        const h = { regla: `${a.pluginid} ${a.alert}`, ruta: `${nombre} (${a.instances?.length ?? 0} lugares)`, severidad: RIESGO[riesgo], riesgo };
        const ok = aceptado('zap', `${a.pluginid} ${a.alert}`, nombre);
        hallazgos.push(ok ? { ...h, motivo: ok.motivo } : h);
      }
    }
  }
  const nuevos = hallazgos.filter((h) => !h.motivo);
  const altos = nuevos.filter((h) => h.riesgo >= 3);
  const medios = nuevos.filter((h) => h.riesgo === 2);
  return control({
    id: 'DAST-01',
    titulo: 'Ataque simulado desde afuera (OWASP ZAP baseline)',
    estado: sinCorrer.length === objetivos.length ? 'gris' : altos.length ? 'rojo' : medios.length || nuevos.length ? 'amarillo' : 'verde',
    resumen: `${objetivos.length - sinCorrer.length} sitios revisados (${objetivos.map((o) => o[0]).join(', ')}): ${altos.length} riesgos altos, ${medios.length} medios, ${nuevos.length - altos.length - medios.length} bajos; ${hallazgos.length - nuevos.length} aceptados.${sinCorrer.length ? ` Sin revisar: ${sinCorrer.join(', ')}.` : ''}`,
    detalle: hallazgos.sort((a, b) => b.riesgo - a.riesgo).map((h) => `[${h.severidad}] ${h.regla} — ${h.ruta}${h.motivo ? ` (aceptado: ${h.motivo})` : ''}`),
    normas: ['asvs-v14', 'asvs-v3', 'soc2-cc7.1', 'iso-a8.8', 'iso-a8.29'],
  });
}

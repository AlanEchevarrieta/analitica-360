// Seguridad: secretos (Gitleaks), código (Semgrep / OWASP), imágenes (Trivy),
// dependencias (pnpm audit) y cabeceras HTTP.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { aceptado, API, control, correr, leerJson, RAIZ, rutaDocker, WEB } from './comun.mjs';

const IMAGENES = ['analitica360-api', 'analitica360-web', 'analitica360-tienda'];

/** Separa hallazgos nuevos de los ya aceptados en riesgos-aceptados.json. */
function clasificar(herramienta, hallazgos) {
  const nuevos = [];
  const aceptados = [];
  for (const h of hallazgos) {
    const a = aceptado(herramienta, h.regla, h.ruta);
    (a ? aceptados : nuevos).push(a ? { ...h, motivo: a.motivo } : h);
  }
  return { nuevos, aceptados };
}

const lineas = (lista, max = 15) => lista.slice(0, max).map((h) => `${h.severidad ? `[${h.severidad}] ` : ''}${h.regla} — ${h.ruta}${h.motivo ? ` (aceptado: ${h.motivo})` : ''}`);

export async function gitleaks(dir) {
  const r = await correr('docker', ['run', '--rm', '-v', `${rutaDocker(RAIZ)}:/repo`, 'zricethezav/gitleaks:latest', 'git', '/repo', '--report-format', 'json', '--report-path', `/repo/${path.relative(RAIZ, dir).replace(/\\/g, '/')}/gitleaks.json`, '--no-banner', '--redact']);
  const datos = leerJson(path.join(dir, 'gitleaks.json'));
  if (!datos) return control({ id: 'SEC-01', titulo: 'Secretos en el código y su historial (Gitleaks)', estado: 'gris', resumen: `No se pudo correr: ${r.error.slice(-200)}`, normas: ['asvs-v2.10', 'soc2-cc6.1', 'iso-a8.4'] });
  const { nuevos, aceptados } = clasificar('gitleaks', datos.map((x) => ({ regla: x.RuleID, ruta: `${x.File}:${x.StartLine}` })));
  const commits = /(\d+) commits scanned/.exec(r.error + r.salida)?.[1];
  return control({
    id: 'SEC-01',
    titulo: 'Secretos en el código y su historial (Gitleaks)',
    estado: nuevos.length ? 'rojo' : 'verde',
    resumen: `${commits ? `${commits} commits revisados. ` : ''}${nuevos.length} secretos nuevos, ${aceptados.length} aceptados (de ejemplo o solo locales).`,
    detalle: lineas([...nuevos, ...aceptados]),
    normas: ['asvs-v2.10', 'soc2-cc6.1', 'iso-a8.4', 'iso-a5.17'],
  });
}

export async function semgrep(dir) {
  const archivos = ['apps/api/src', 'apps/web/src', 'apps/tienda/app', 'apps/tienda/lib', 'apps/tienda/components', 'apps/api/Dockerfile', 'apps/web/Dockerfile', 'apps/tienda/Dockerfile'];
  // El código va por stdin (tar): montar la carpeta de Windows en el contenedor es lentísimo.
  const tar = spawn('tar', ['cf', '-', '--exclude=node_modules', '--exclude=.next', ...archivos], { cwd: RAIZ });
  const reglas = ['p/owasp-top-ten', 'p/typescript', 'p/nodejsscan', 'p/secrets', 'p/docker'].flatMap((c) => ['--config', c]);
  const cmd = `mkdir -p /tmp/codigo && tar xf - -C /tmp/codigo && cd /tmp/codigo && semgrep scan ${reglas.join(' ')} --json --metrics=off --quiet --timeout 30 . 2>/dev/null`;
  const r = await correr('docker', ['run', '--rm', '-i', 'semgrep/semgrep', 'sh', '-c', cmd], { entrada: tar.stdout });
  let datos = null;
  try {
    datos = JSON.parse(r.salida);
    fs.writeFileSync(path.join(dir, 'semgrep.json'), r.salida);
  } catch {
    /* sin resultado */
  }
  if (!datos) return control({ id: 'SEC-02', titulo: 'Análisis del código (Semgrep, reglas OWASP Top 10)', estado: 'gris', resumen: 'No se pudo correr Semgrep (¿sin internet para bajar las reglas?).', normas: ['asvs-v1', 'soc2-cc8.1', 'iso-a8.28'] });
  const hallazgos = datos.results.map((x) => ({ regla: x.check_id.split('.').slice(-1)[0], ruta: `${x.path}:${x.start.line}`, severidad: x.extra.severity }));
  const { nuevos, aceptados } = clasificar('semgrep', hallazgos);
  const graves = nuevos.filter((h) => h.severidad === 'ERROR');
  return control({
    id: 'SEC-02',
    titulo: 'Análisis del código (Semgrep, reglas OWASP Top 10)',
    estado: graves.length ? 'rojo' : nuevos.length ? 'amarillo' : 'verde',
    resumen: `${nuevos.length} hallazgos nuevos (${graves.length} graves), ${aceptados.length} aceptados. ${datos.errors.length ? `${datos.errors.length} archivos no se terminaron de analizar (tiempo).` : ''}`.trim(),
    detalle: lineas([...nuevos, ...aceptados]),
    normas: ['asvs-v1', 'asvs-v5', 'soc2-cc8.1', 'iso-a8.28', 'iso-a8.29'],
  });
}

export async function trivy(dir) {
  const resultados = [];
  for (const img of IMAGENES) {
    const r = await correr('docker', [
      'run', '--rm', '-v', '/var/run/docker.sock:/var/run/docker.sock', '-v', 'trivy-cache:/root/.cache', '-v', `${rutaDocker(dir)}:/out`,
      'aquasec/trivy:latest', 'image', '--quiet', '--scanners', 'vuln', '--severity', 'HIGH,CRITICAL', '--ignore-unfixed', '--format', 'json', '--output', `/out/trivy-${img}.json`, img,
    ]);
    const datos = leerJson(path.join(dir, `trivy-${img}.json`));
    if (!datos) {
      resultados.push({ img, error: r.error.slice(-150) });
      continue;
    }
    const v = (datos.Results ?? []).flatMap((x) => (x.Vulnerabilities ?? []).map((y) => ({ regla: y.VulnerabilityID, ruta: `${img} ${y.PkgName} ${y.InstalledVersion}→${y.FixedVersion}`, severidad: y.Severity })));
    resultados.push({ img, ...clasificar('trivy', v) });
  }
  const nuevos = resultados.flatMap((r) => r.nuevos ?? []);
  const aceptados = resultados.flatMap((r) => r.aceptados ?? []);
  const fallidas = resultados.filter((r) => r.error);
  const criticas = nuevos.filter((h) => h.severidad === 'CRITICAL');
  return control({
    id: 'SEC-03',
    titulo: 'Vulnerabilidades en las imágenes Docker (Trivy)',
    estado: fallidas.length === IMAGENES.length ? 'gris' : criticas.length ? 'rojo' : nuevos.length ? 'amarillo' : 'verde',
    resumen: `${IMAGENES.length - fallidas.length} imágenes revisadas: ${criticas.length} críticas y ${nuevos.length - criticas.length} altas con arreglo disponible; ${aceptados.length} aceptadas.${fallidas.length ? ` Sin revisar: ${fallidas.map((f) => f.img).join(', ')}.` : ''}`,
    detalle: lineas([...nuevos, ...aceptados]),
    normas: ['asvs-v14', 'soc2-cc7.1', 'iso-a8.8'],
  });
}

export async function dependencias(dir) {
  const r = await correr('pnpm', ['audit', '--prod', '--json'], { env: { FORCE_COLOR: '0' } });
  let datos = null;
  try {
    datos = JSON.parse(r.salida);
    fs.writeFileSync(path.join(dir, 'pnpm-audit.json'), r.salida);
  } catch {
    /* sin resultado */
  }
  if (!datos?.advisories) return control({ id: 'SEC-04', titulo: 'Dependencias con vulnerabilidades conocidas (pnpm audit)', estado: 'gris', resumen: 'No se pudo consultar la base de vulnerabilidades.', normas: ['asvs-v14', 'soc2-cc7.1', 'iso-a8.8'] });
  const hallazgos = Object.values(datos.advisories).map((a) => ({ regla: a.github_advisory_id ?? String(a.id), ruta: `${a.module_name} (${a.findings?.[0]?.paths?.[0] ?? ''})`, severidad: a.severity }));
  const { nuevos, aceptados } = clasificar('pnpm-audit', hallazgos);
  const graves = nuevos.filter((h) => ['critical', 'high'].includes(h.severidad));
  return control({
    id: 'SEC-04',
    titulo: 'Dependencias con vulnerabilidades conocidas (pnpm audit)',
    estado: nuevos.some((h) => h.severidad === 'critical') ? 'rojo' : graves.length ? 'amarillo' : 'verde',
    resumen: `${nuevos.length} nuevas (${graves.length} altas o críticas), ${aceptados.length} aceptadas.`,
    detalle: lineas([...nuevos, ...aceptados]),
    normas: ['asvs-v14', 'soc2-cc7.1', 'iso-a8.8'],
  });
}

const CABECERAS = {
  web: ['x-frame-options', 'x-content-type-options', 'referrer-policy', 'strict-transport-security', 'permissions-policy'],
  api: ['x-frame-options', 'x-content-type-options', 'strict-transport-security'],
};

export async function cabeceras() {
  const faltan = [];
  const filtran = [];
  for (const [nombre, url] of [['web', `${WEB}/sign-in`], ['api', API]]) {
    try {
      const r = await fetch(url, { redirect: 'manual' });
      for (const c of CABECERAS[nombre]) if (!r.headers.get(c)) faltan.push(`${nombre}: falta ${c}`);
      if (r.headers.get('x-powered-by')) filtran.push(`${nombre}: anuncia ${r.headers.get('x-powered-by')}`);
    } catch (e) {
      return control({ id: 'SEC-05', titulo: 'Cabeceras de seguridad HTTP', estado: 'gris', resumen: `No responde ${url}: ${e.message}`, normas: ['asvs-v14.4', 'iso-a8.9'] });
    }
  }
  return control({
    id: 'SEC-05',
    titulo: 'Cabeceras de seguridad HTTP',
    estado: faltan.length ? 'rojo' : filtran.length ? 'amarillo' : 'verde',
    resumen: faltan.length || filtran.length ? `${faltan.length} cabeceras faltantes, ${filtran.length} datos de más.` : 'Web y API mandan todas las cabeceras de seguridad y no anuncian su tecnología.',
    detalle: [...faltan, ...filtran],
    normas: ['asvs-v14.4', 'soc2-cc6.6', 'iso-a8.9'],
  });
}

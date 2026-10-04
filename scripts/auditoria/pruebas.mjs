// Pruebas automáticas: unitarias de la API y de punta a punta (e2e) contra una
// base descartable, que incluyen aislamiento entre empresas, permisos, la
// bitácora inalterable y la concurrencia.
import { control, correr } from './comun.mjs';

const BASE_E2E = 'pg-e2e';
const URL_E2E = 'postgresql://postgres:e2e@localhost:5499/postgres';

const resumenVitest = (salida) => {
  const tests = /Tests\s+(?:(\d+) failed \| )?(\d+) passed/.exec(salida.replace(/\x1b\[[0-9;]*m/g, ''));
  return tests ? { fallidos: Number(tests[1] ?? 0), pasados: Number(tests[2]) } : null;
};

async function baseE2e() {
  const existe = await correr('docker', ['start', BASE_E2E]);
  if (existe.codigo !== 0) await correr('docker', ['run', '-d', '--name', BASE_E2E, '-e', 'POSTGRES_PASSWORD=e2e', '-p', '5499:5432', 'postgres:16']);
  for (let i = 0; i < 60; i++) {
    if ((await correr('docker', ['exec', BASE_E2E, 'pg_isready', '-U', 'postgres'])).codigo === 0) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  await new Promise((r) => setTimeout(r, 1500));
  return correr('pnpm', ['--filter', 'api', 'exec', 'prisma', 'migrate', 'deploy'], { env: { DATABASE_URL: URL_E2E } });
}

export async function pruebas() {
  const unit = await correr('pnpm', ['--filter', 'api', 'exec', 'vitest', 'run'], { env: { FORCE_COLOR: '0' } });
  const migr = await baseE2e();
  const e2e = migr.codigo === 0 ? await correr('pnpm', ['--filter', 'api', 'exec', 'vitest', 'run', '--config', 'vitest.config.e2e.ts'], { env: { E2E_DATABASE_URL: URL_E2E, FORCE_COLOR: '0' } }) : null;
  const u = resumenVitest(unit.salida);
  const e = e2e && resumenVitest(e2e.salida);
  const fallidas = (u?.fallidos ?? 1) + (e?.fallidos ?? 1);
  const fallos = [...(unit.salida + (e2e?.salida ?? '')).matchAll(/(?:×|FAIL)\s+(.+)/g)].map((m) => m[1].trim()).slice(0, 10);
  return control({
    id: 'TST-01',
    titulo: 'Pruebas automáticas (unitarias y de punta a punta)',
    estado: !u || !e ? 'gris' : fallidas ? 'rojo' : 'verde',
    resumen: `Unitarias: ${u ? `${u.pasados} pasan, ${u.fallidos} fallan` : 'no corrieron'}. De punta a punta: ${e ? `${e.pasados} pasan, ${e.fallidos} fallan` : `no corrieron${migr.codigo !== 0 ? ' (no se pudo preparar la base de prueba)' : ''}`}.`,
    detalle: [
      'Incluye: aislamiento entre empresas, permisos por rol, consola solo para administradores, bitácora inalterable y a prueba de manipulación, 20 cambios simultáneos, cupones y cobros.',
      ...fallos,
    ],
    normas: ['soc2-cc8.1', 'soc2-cc6.1', 'iso-a8.29', 'asvs-v4', 'asvs-v1'],
  });
}

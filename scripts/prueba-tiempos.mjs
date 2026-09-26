// Mide cuánto tarda cada consulta de la API (mediana de 3). Uso: node scripts/prueba-tiempos.mjs <clerkUserId> [etiqueta]
// Uso: node tiempos.mjs <clerkUserId> [etiqueta]  -> mediana de 3 llamadas por ruta, de la más lenta a la más rápida.
import fs from 'node:fs';

const env = Object.fromEntries(fs.readFileSync(new URL('../apps/api/.env', import.meta.url), 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]));
const clerk = (p, body) => fetch(`https://api.clerk.com/v1${p}`, { method: 'POST', headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) }).then((r) => r.json());
const [usuario, etiqueta = ''] = process.argv.slice(2);

const ANIO = 'desde=2025-09-27&hasta=2026-09-26';
const TODO = 'desde=2000-01-01&hasta=2026-09-26';
const MES = 'desde=2026-09-01&hasta=2026-09-26';
const RUTAS = [
  '/analytics/dashboard',
  `/analytics/periodo?${MES}&granularidad=dia`,
  `/analytics/periodo?${ANIO}&granularidad=semana`,
  `/analytics/periodo?${TODO}&granularidad=mes`,
  '/analytics/insights?pronostico=semana',
  '/analytics/insights/combos',
  '/analytics/insights/combos-3',
  `/analytics/inflacion?desde=2026-01-01&hasta=2026-09-26`,
  `/contabilidad?${MES}`,
  `/contabilidad?${ANIO}`,
  `/estados-contables?${MES}`,
  `/estados-contables?${TODO}`,
  `/gastos?desde=2000-01-01&hasta=2026-09-26`,
  '/productos?pagina=1&pageSize=200&estado=activos&orden=demanda',
  '/productos?pagina=1&pageSize=20&busqueda=mate',
  '/ventas?pagina=1&pageSize=25',
  `/ventas?pagina=1&pageSize=25&${ANIO}`,
  '/compras?pagina=1&pageSize=20',
  '/pedidos?pagina=1&pageSize=20',
  '/clientes',
  '/proveedores?pagina=1&pageSize=20',
  '/devoluciones?pagina=1&pageSize=20',
  '/productos/c2067b52-41b0-4ab2-9f42-2d7f7c7a3cbe/movimientos',
  '/configuracion',
  '/suscripcion',
  '/tickets',
  '/tickets/no-leidos',
  '/admin/yo',
  '/admin/metrics',
  '/admin/empresas',
  '/admin/evolucion',
  '/admin/capacidad',
];

const s = await clerk('/sessions', { user_id: usuario });
const filas = [];
try {
  for (const ruta of RUTAS) {
    const tiempos = [];
    let status = 0;
    for (let i = 0; i < 3; i++) {
      const { jwt } = await clerk(`/sessions/${s.id}/tokens`);
      const t0 = performance.now();
      const res = await fetch(`http://localhost:3001${ruta}`, { headers: { Authorization: `Bearer ${jwt}` } });
      await res.arrayBuffer();
      tiempos.push(performance.now() - t0);
      status = res.status;
    }
    tiempos.sort((a, b) => a - b);
    filas.push({ ruta, ms: Math.round(tiempos[1]), status });
  }
} finally {
  await clerk(`/sessions/${s.id}/revoke`);
}
filas.sort((a, b) => b.ms - a.ms);
console.log(`== ${etiqueta} (mediana de 3)`);
for (const f of filas) console.log(`${String(f.ms).padStart(6)} ms  ${f.status}  ${f.ruta}`);
fs.writeFileSync(`${process.env.TEMP ?? '.'}/tiempos-${etiqueta || 'x'}.json`, JSON.stringify(filas, null, 2));

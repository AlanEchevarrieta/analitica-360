// Prueba de carga (API local en :3001): N usuarios simultáneos pidiendo pantallas comunes durante S segundos.
// Uso: node carga.mjs <clerkUserId> <usuarios> <segundos>
import fs from 'node:fs';

const env = Object.fromEntries(fs.readFileSync(new URL('../apps/api/.env', import.meta.url), 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]));
const clerk = (p, body) => fetch(`https://api.clerk.com/v1${p}`, { method: 'POST', headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) }).then((r) => r.json());
const [usuario, n = '50', seg = '20'] = process.argv.slice(2);

// Mezcla típica de un día de trabajo (lo más pedido primero).
const RUTAS = [
  '/analytics/dashboard',
  '/productos?pagina=1&pageSize=200&estado=activos&orden=demanda',
  '/ventas?pagina=1&pageSize=25',
  '/configuracion',
  '/tickets/no-leidos',
  '/admin/yo',
  '/suscripcion',
  '/clientes',
  '/analytics/periodo?desde=2026-09-01&hasta=2026-09-26&granularidad=dia',
  '/contabilidad?desde=2026-09-01&hasta=2026-09-26',
  '/estados-contables?desde=2026-09-01&hasta=2026-09-26',
];

const excluir = (process.env.EXCLUIR ?? '').split(',').filter(Boolean);
const soloEstas = (process.env.SOLO ?? '').split(',').filter(Boolean);
for (let i = RUTAS.length - 1; i >= 0; i--) {
  if (excluir.some((e) => RUTAS[i].includes(e)) || (soloEstas.length && !soloEstas.some((e) => RUTAS[i].includes(e)))) RUTAS.splice(i, 1);
}
const sesion = await clerk('/sessions', { user_id: usuario });
const { jwt } = await clerk(`/sessions/${sesion.id}/tokens`); // dura 60 s: alcanza para la prueba
const fin = Date.now() + Number(seg) * 1000;
const tiempos = [];
let errores = 0;
/** Qué fallaron: código HTTP o tipo de error de red. */
const fallas = new Map();
const fallo = (k) => fallas.set(k, (fallas.get(k) ?? 0) + 1);
const porRuta = new Map();

async function usuarioVirtual(i) {
  let k = i;
  while (Date.now() < fin) {
    const ruta = RUTAS[k++ % RUTAS.length];
    const t0 = performance.now();
    try {
      const r = await fetch(`http://localhost:3001${ruta}`, { headers: { Authorization: `Bearer ${jwt}` } });
      await r.arrayBuffer();
      if (!r.ok) {
        errores++;
        fallo(`${r.status} ${ruta.split('?')[0]}`);
      }
    } catch (e) {
      errores++;
      fallo(`${e.cause?.code ?? e.name} ${ruta.split('?')[0]}`);
    }
    const ms = performance.now() - t0;
    tiempos.push(ms);
    const lista = porRuta.get(ruta) ?? [];
    lista.push(ms);
    porRuta.set(ruta, lista);
  }
}

const t0 = Date.now();
await Promise.all(Array.from({ length: Number(n) }, (_, i) => usuarioVirtual(i)));
const duracion = (Date.now() - t0) / 1000;
await clerk(`/sessions/${sesion.id}/revoke`);

const p = (arr, q) => { const s = [...arr].sort((a, b) => a - b); return Math.round(s[Math.min(s.length - 1, Math.floor(s.length * q))]); };
console.log(`${n} usuarios simultáneos, ${duracion.toFixed(0)} s: ${tiempos.length} pedidos (${Math.round(tiempos.length / duracion)} por segundo), errores: ${errores}`);
if (fallas.size) console.log(`errores: ${[...fallas].map(([k, v]) => `${v}× ${k}`).join(' · ')}`);
console.log(`tiempo de respuesta: mediana ${p(tiempos, 0.5)} ms · 95% por debajo de ${p(tiempos, 0.95)} ms · peor ${p(tiempos, 1)} ms`);
for (const [ruta, arr] of [...porRuta].sort((a, b) => p(b[1], 0.95) - p(a[1], 0.95)).slice(0, 5)) console.log(`  p95 ${String(p(arr, 0.95)).padStart(5)} ms  ${ruta}`);

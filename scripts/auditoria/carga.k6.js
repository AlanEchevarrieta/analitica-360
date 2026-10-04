// Prueba de carga (k6): usuarios simultáneos navegando la app de una empresa real.
// Solo lecturas (GET): no cambia datos. La corre scripts/auditoria/auditar.mjs con
// un token de sesión de 10 minutos y la API en API_URL.
import http from 'k6/http';
import { check, sleep } from 'k6';

const API = __ENV.API_URL;
const TOKEN = __ENV.TOKEN;
const VUS = Number(__ENV.VUS || 30);
const DURACION = __ENV.DURACION || '40s';

const hoy = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const hace30 = new Date(Date.now() - 33 * 86400_000).toISOString().slice(0, 10);
const inicioMes = `${hoy.slice(0, 7)}-01`;

// Lo que abre una persona al usar la app, con su peso aproximado (las más vistas pesan más).
const PANTALLAS = [
  ['inicio', `/analytics/dashboard`, 4],
  ['inicio-serie', `/analytics/dashboard/serie-home`, 4],
  ['ventas', `/ventas?pagina=1&pageSize=50`, 3],
  ['productos', `/productos?pagina=1&pageSize=50`, 3],
  ['movimientos', `/inventario/movimientos?desde=${hace30}&hasta=${hoy}&pagina=1&pageSize=50`, 2],
  ['analytics-periodo', `/analytics/periodo?desde=${inicioMes}&hasta=${hoy}&granularidad=dia`, 2],
  ['rendimiento', `/analytics/rendimiento?desde=${hace30}&hasta=${hoy}`, 1],
  ['contabilidad', `/contabilidad?desde=${inicioMes}&hasta=${hoy}`, 1],
  ['insights', `/analytics/insights?pronostico=mes`, 1],
  ['clientes', `/clientes`, 1],
];
const BOLSA = PANTALLAS.flatMap((p) => Array(p[2]).fill(p));

export const options = {
  scenarios: {
    navegacion: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '15s', target: VUS },
        { duration: DURACION, target: VUS },
        { duration: '5s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1500'],
    ...Object.fromEntries(PANTALLAS.map(([n]) => [`http_req_duration{pantalla:${n}}`, ['p(95)<3000']])),
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

export default function () {
  const [nombre, ruta] = BOLSA[Math.floor(Math.random() * BOLSA.length)];
  const r = http.get(`${API}${ruta}`, { headers: { Authorization: `Bearer ${TOKEN}` }, tags: { pantalla: nombre } });
  check(r, { 'responde 200': (x) => x.status === 200 });
  sleep(0.5 + Math.random()); // una persona no pide todo de golpe
}

export function handleSummary(data) {
  return { [__ENV.SALIDA || '/out/k6.json']: JSON.stringify(data), stdout: '' };
}

// pnpm auditar — corre todas las auditorías y deja un informe con semáforo.
//
//   pnpm auditar                      todo (≈ 25 min)
//   pnpm auditar -- --rapido          sin Semgrep, ZAP ni el pico de 100 usuarios (≈ 5 min)
//   pnpm auditar -- --solo datos,backup   solo esas familias
//
// Familias: pruebas, seguridad, dast, carga, datos, backup.
// Necesita Docker y la app levantada (scripts/levantar-docker.ps1).
// Informe: .auditorias/<fecha>/informe.md (+ JSON) y una copia en Obsidian
// (OBSIDIAN_DIR, por defecto ~/Documents/Alan/Analítica 360/Auditorías).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { calidadDatos, integridadBitacora } from './datos.mjs';
import { carga } from './carga.mjs';
import { COLOR, leerJson, peor, RAIZ } from './comun.mjs';
import { evaluarMatriz } from './cumplimiento.mjs';
import { zap } from './dast.mjs';
import { escribirInforme } from './informe.mjs';
import { pruebas } from './pruebas.mjs';
import { cabeceras, dependencias, gitleaks, semgrep, trivy } from './seguridad.mjs';
import { simulacroBackup } from './backup.mjs';

const args = process.argv.slice(2);
const rapido = args.includes('--rapido');
const solo = args.includes('--solo') ? args[args.indexOf('--solo') + 1].split(',') : null;
const quiere = (familia) => !solo || solo.includes(familia);

const config = { ...leerJson(path.join(RAIZ, '.auditorias/config.json'), {}) };
const usuarioCarga = process.env.AUDITORIA_USUARIO_CARGA ?? config.usuarioCarga;

const inicio = new Date();
const sello = new Date(inicio.getTime() - 3 * 3600_000).toISOString().slice(0, 16).replace('T', ' ').replace(':', '');
const dir = path.join(RAIZ, '.auditorias', sello.replace(' ', '_'));
fs.mkdirSync(dir, { recursive: true });

const PASOS = [
  ['pruebas', 'Pruebas automáticas', () => pruebas()],
  ['seguridad', 'Secretos (Gitleaks)', () => gitleaks(dir)],
  ['seguridad', 'Código (Semgrep)', () => (rapido ? null : semgrep(dir))],
  ['seguridad', 'Imágenes Docker (Trivy)', () => trivy(dir)],
  ['seguridad', 'Dependencias (pnpm audit)', () => dependencias(dir)],
  ['seguridad', 'Cabeceras HTTP', () => cabeceras()],
  ['dast', 'Ataque simulado (ZAP)', () => (rapido ? null : zap(dir))],
  ['carga', 'Carga (k6)', () => carga(dir, { usuario: usuarioCarga, rapido })],
  ['datos', 'Calidad de datos', () => calidadDatos()],
  ['datos', 'Integridad de la bitácora', () => integridadBitacora()],
  ['backup', 'Simulacro de backup', () => simulacroBackup(dir)],
];

const controles = [];
for (const [familia, nombre, correr] of PASOS) {
  if (!quiere(familia)) continue;
  const t0 = Date.now();
  console.log(`… ${nombre}`);
  let r;
  try {
    r = await correr();
  } catch (e) {
    r = { id: nombre, titulo: nombre, estado: 'gris', resumen: `Error inesperado: ${e.message}`, detalle: [], normas: [] };
  }
  if (!r) {
    console.log(`⏭️  ${nombre} (salteado en modo rápido)`);
    continue;
  }
  r.segundos = Math.round((Date.now() - t0) / 1000);
  controles.push(r);
  console.log(`${COLOR[r.estado]} ${nombre} (${r.segundos} s): ${r.resumen}`);
}

const matriz = evaluarMatriz(controles);
const general = peor(...controles.map((c) => c.estado));
const resultado = { fecha: inicio.toISOString(), sello, modo: rapido ? 'rápido' : solo ? `solo ${solo.join(', ')}` : 'completo', maquina: os.hostname(), general, controles, matriz };
fs.writeFileSync(path.join(dir, 'resultado.json'), JSON.stringify(resultado, null, 2));
const destinos = escribirInforme(resultado, dir);
console.log(`\n${COLOR[general]} Resultado general. Informe: ${destinos.join(' y ')}`);
process.exit(general === 'rojo' ? 1 : 0);

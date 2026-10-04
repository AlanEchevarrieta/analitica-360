// Informe de la auditoría en Markdown: semáforo, qué hacer primero, detalle de
// cada control y la matriz de cumplimiento. Se guarda junto a los JSON y en Obsidian.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { COLOR } from './comun.mjs';

const OBSIDIAN = process.env.OBSIDIAN_DIR ?? path.join(os.homedir(), 'Documents', 'Alan', 'Analítica 360', 'Auditorías');
const NOMBRE = { verde: 'Bien', amarillo: 'Mirar', rojo: 'Corregir', gris: 'No se pudo revisar' };

const contar = (lista) => Object.fromEntries(['verde', 'amarillo', 'rojo', 'gris'].map((e) => [e, lista.filter((x) => x.estado === e).length]));
const fila = (...celdas) => `| ${celdas.map((c) => String(c ?? '').replace(/\|/g, '/').replace(/\n/g, ' ')).join(' | ')} |`;

export function markdown(r) {
  const c = contar(r.controles);
  const m = contar(r.matriz);
  const porMarco = Object.entries(Object.groupBy(r.matriz, (x) => x.marco)).map(([marco, lista]) => {
    const k = contar(lista);
    return fila(marco, lista.length, k.verde, k.amarillo, k.rojo, k.gris, `${Math.round((k.verde / lista.length) * 100)} %`);
  });
  const urgentes = [
    ...r.controles.filter((x) => x.estado === 'rojo').map((x) => `- ${COLOR.rojo} **${x.titulo}** (${x.id}): ${x.resumen}`),
    ...r.matriz.filter((x) => x.estado === 'rojo' && x.como === 'manual').map((x) => `- ${COLOR.rojo} **${x.marco} ${x.ref} · ${x.titulo}:** ${x.evidencia}`),
  ];
  const mirar = r.controles.filter((x) => x.estado === 'amarillo').map((x) => `- ${COLOR.amarillo} **${x.titulo}** (${x.id}): ${x.resumen}`);

  return `# Auditoría ${r.sello}

${COLOR[r.general]} **Resultado general: ${NOMBRE[r.general]}** · modo ${r.modo} · ${new Date(r.fecha).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}

Controles automáticos: ${COLOR.verde} ${c.verde} · ${COLOR.amarillo} ${c.amarillo} · ${COLOR.rojo} ${c.rojo} · ${COLOR.gris} ${c.gris}
Requisitos de normas: ${COLOR.verde} ${m.verde} · ${COLOR.amarillo} ${m.amarillo} · ${COLOR.rojo} ${m.rojo} · ${COLOR.gris} ${m.gris} (de ${r.matriz.length})

## Qué hacer primero
${urgentes.length ? urgentes.join('\n') : 'Nada urgente. 🎉'}
${mirar.length ? `\n**Para mirar:**\n${mirar.join('\n')}` : ''}

## Controles automáticos
${fila('', 'Control', 'Resultado', 'Tiempo')}
| --- | --- | --- | --- |
${r.controles.map((x) => fila(COLOR[x.estado], `**${x.id}** ${x.titulo}`, x.resumen, `${x.segundos ?? '?'} s`)).join('\n')}

${r.controles
  .filter((x) => x.detalle.length)
  .map((x) => `### ${COLOR[x.estado]} ${x.id} · ${x.titulo}\n${x.detalle.map((d) => `- ${d}`).join('\n')}`)
  .join('\n\n')}

## Cumplimiento por norma
${fila('Norma', 'Requisitos', COLOR.verde, COLOR.amarillo, COLOR.rojo, COLOR.gris, 'Cumplido')}
| --- | --- | --- | --- | --- | --- | --- |
${porMarco.join('\n')}

### Matriz completa
${fila('', 'Norma', 'Ref.', 'Requisito', 'Cómo se evalúa', 'Evidencia')}
| --- | --- | --- | --- | --- | --- |
${r.matriz.map((x) => fila(COLOR[x.estado], x.marco, x.ref, x.titulo, x.como, x.evidencia)).join('\n')}

---
Generado por \`pnpm auditar\` (scripts/auditoria). Los hallazgos ya evaluados están en \`scripts/auditoria/riesgos-aceptados.json\`, con su motivo y su fecha de revisión.
`;
}

export function escribirInforme(r, dir) {
  const texto = markdown(r);
  const destinos = [path.join(dir, 'informe.md')];
  fs.writeFileSync(destinos[0], texto);
  try {
    fs.mkdirSync(OBSIDIAN, { recursive: true });
    const nota = path.join(OBSIDIAN, `Auditoría ${r.sello}.md`);
    fs.writeFileSync(nota, `Ver también [[Auditorías automáticas]] y [[Pendientes]].\n\n${texto}`);
    destinos.push(nota);
    // Índice con el historial: una línea por corrida, la más nueva arriba.
    const indice = path.join(OBSIDIAN, 'Auditorías automáticas.md');
    const previo = fs.existsSync(indice) ? fs.readFileSync(indice, 'utf8') : '';
    const linea = `- ${COLOR[r.general]} [[Auditoría ${r.sello}]] · ${r.modo} · controles ${r.controles.map((x) => COLOR[x.estado]).join('')}`;
    const cuerpo = previo.includes('## Historial') ? previo.replace('## Historial\n', `## Historial\n${linea}\n`) : `${CABECERA_INDICE}\n## Historial\n${linea}\n`;
    fs.writeFileSync(indice, cuerpo);
  } catch {
    /* sin Obsidian: queda el informe local */
  }
  return destinos;
}

const CABECERA_INDICE = `# Auditorías automáticas

Se corren con \`pnpm auditar\` desde la carpeta del proyecto (con Docker y la app levantados).
Cada corrida deja un informe con semáforo y la matriz de cumplimiento contra OWASP ASVS, SOC 2, ISO 27001 y Ley 25.326 / GDPR.

- \`pnpm auditar\`: todo (unos 25 minutos).
- \`pnpm auditar -- --rapido\`: sin Semgrep, ZAP ni el pico de 100 usuarios (unos 5 minutos).
- \`pnpm auditar -- --solo datos,backup\`: solo esas familias (pruebas, seguridad, dast, carga, datos, backup).

Qué revisa: pruebas automáticas, secretos (Gitleaks), código (Semgrep), imágenes (Trivy), dependencias, cabeceras, ataque simulado (OWASP ZAP), carga (k6 con 30 y 100 usuarios), calidad de datos, integridad de la bitácora y simulacro de backup y restauración.

Ver también [[Auditoría 2026-10-03]] (la primera, hecha a mano) y [[Pendientes]].
`;

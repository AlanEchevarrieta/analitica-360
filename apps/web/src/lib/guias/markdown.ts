import { marked } from "marked";

const CALLOUT_ICONS: Record<string, string> = {
  info: "ℹ️",
  tip: "💡",
  warning: "⚠️",
  abstract: "📋",
  faq: "❓",
};

const CALLOUT_TITLES: Record<string, string> = {
  info: "Información Clave",
  tip: "Consejo Práctico",
  warning: "Advertencia Importante",
  abstract: "Requisitos Previos",
  faq: "Preguntas Frecuentes",
};

/**
 * Pre-procesa callouts estilo Obsidian en bloques HTML antes de parsear con marked.
 */
function preprocesarCallouts(markdown: string): string {
  // Regex para bloques de callouts continuos:
  // > [!type] Titulo opcional
  // > Linea 1
  // > Linea 2
  const calloutRegex = /^>[ \t]*\[!(info|tip|warning|abstract|faq)\][ \t]*(.*?)\r?\n((?:^[ \t]*>.*(?:\r?\n|$))*)/gim;

  return markdown.replace(calloutRegex, (_match, tipo, tituloPersonalizado, lineasCuerpo) => {
    const t = (tipo || "info").toLowerCase();
    const icono = CALLOUT_ICONS[t] || "ℹ️";
    const titulo = tituloPersonalizado.trim() || CALLOUT_TITLES[t] || "Nota";

    // Limpiar el prefijo "> " de cada línea del cuerpo
    const cuerpoLimpio = (lineasCuerpo || "")
      .split(/\r?\n/)
      .map((linea: string) => linea.replace(/^[ \t]*>[ \t]?/, ""))
      .join("\n")
      .trim();

    return `\n\n<div class="guia-callout guia-callout-${t}">
<div class="guia-callout-header">
  <span>${icono}</span>
  <span>${titulo}</span>
</div>
<div class="guia-callout-body">

${cuerpoLimpio}

</div>
</div>\n\n`;
  });
}

/**
 * Pre-procesa bloques de código Mermaid para que no rompan la visualización
 * y se presenten como un bloque visual con etiqueta.
 */
function preprocesarMermaid(markdown: string): string {
  const mermaidRegex = /```mermaid\r?\n([\s\S]*?)```/gim;
  return markdown.replace(mermaidRegex, (_match, diagrama) => {
    return `\n\n<div class="guia-mermaid-box">
<div class="guia-mermaid-header">
  <span>🔄 Diagrama de Proceso / Flujo</span>
  <span class="text-[10px] tracking-normal font-mono opacity-70">Mermaid Workflow</span>
</div>
<pre><code>${diagrama.trim()}</code></pre>
</div>\n\n`;
  });
}

/**
 * Ajusta detalles y tablas en el HTML resultante.
 */
function postprocesarHtml(html: string): string {
  let resultado = html;

  // Envolver tablas en un contenedor scrollable con estilo
  resultado = resultado.replace(/<table>([\s\S]*?)<\/table>/gim, '<div class="guia-table-wrapper"><table>$1</table></div>');

  // Asignar clase a los tags <details>
  resultado = resultado.replace(/<details>/gim, '<details class="guia-ficha-tecnica">');

  return resultado;
}

/**
 * Renderiza un texto en formato markdown a HTML enriquecido para las guías de Analítica 360.
 */
export function renderizarGuiaMarkdown(markdown: string): string {
  if (!markdown) return "";

  // 1. Pre-procesar sintaxis Obsidian
  let procesado = preprocesarCallouts(markdown);
  procesado = preprocesarMermaid(procesado);

  // 2. Parsear markdown a HTML con marked
  const htmlRaw = marked.parse(procesado, {
    gfm: true,
    breaks: false,
  }) as string;

  // 3. Post-procesar contenedores y tablas
  return postprocesarHtml(htmlRaw);
}

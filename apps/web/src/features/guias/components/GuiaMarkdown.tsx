"use client";

import React from "react";
import Link from "next/link";
import { marked, type Token, type Tokens } from "marked";

const CALLOUT_ICONS: Record<string, string> = {
  info: "ℹ️",
  tip: "💡",
  warning: "⚠️",
  abstract: "📋",
  faq: "❓",
  example: "🚀",
};

const CALLOUT_TITLES: Record<string, string> = {
  info: "Información Clave",
  tip: "Consejo Práctico",
  warning: "Advertencia Importante",
  abstract: "Requisitos Previos",
  faq: "Preguntas Frecuentes",
  example: "Ejemplo Práctico",
};

function renderizarInline(tokens: Token[] | undefined): React.ReactNode {
  if (!tokens || tokens.length === 0) return null;
  return tokens.map((t, idx) => {
    switch (t.type) {
      case "strong": {
        const st = t as Tokens.Strong;
        return <strong key={idx}>{renderizarInline(st.tokens) ?? st.text}</strong>;
      }
      case "em": {
        const em = t as Tokens.Em;
        return <em key={idx}>{renderizarInline(em.tokens) ?? em.text}</em>;
      }
      case "codespan": {
        const cs = t as Tokens.Codespan;
        return <code key={idx}>{cs.text}</code>;
      }
      case "del": {
        const dl = t as Tokens.Del;
        return <del key={idx}>{renderizarInline(dl.tokens) ?? dl.text}</del>;
      }
      case "link": {
        const lk = t as Tokens.Link;
        const href = lk.href || "#";
        const contenido = renderizarInline(lk.tokens) ?? lk.text;
        if (href.startsWith("/")) {
          return (
            <Link key={idx} href={href}>
              {contenido}
            </Link>
          );
        }
        return (
          <a key={idx} href={href} target="_blank" rel="noopener noreferrer">
            {contenido}
          </a>
        );
      }
      case "br":
        return <br key={idx} />;
      case "text":
      case "escape": {
        const tx = t as Tokens.Text;
        if (tx.tokens && tx.tokens.length > 0) {
          return <React.Fragment key={idx}>{renderizarInline(tx.tokens)}</React.Fragment>;
        }
        return <React.Fragment key={idx}>{tx.text}</React.Fragment>;
      }
      default:
        return <React.Fragment key={idx}>{"raw" in t ? String(t.raw) : ""}</React.Fragment>;
    }
  });
}

function renderizarTokensBloque(tokens: Token[]): React.ReactNode {
  return tokens.map((token, idx) => {
    switch (token.type) {
      case "space":
        return null;
      case "hr":
        return <hr key={idx} />;
      case "heading": {
        const hd = token as Tokens.Heading;
        const hijos = renderizarInline(hd.tokens) ?? hd.text;
        if (hd.depth === 1) return <h1 key={idx}>{hijos}</h1>;
        if (hd.depth === 2) return <h2 key={idx}>{hijos}</h2>;
        if (hd.depth === 3) return <h3 key={idx}>{hijos}</h3>;
        return <h4 key={idx}>{hijos}</h4>;
      }
      case "paragraph": {
        const pg = token as Tokens.Paragraph;
        return <p key={idx}>{renderizarInline(pg.tokens) ?? pg.text}</p>;
      }
      case "code": {
        const cd = token as Tokens.Code;
        if ((cd.lang || "").toLowerCase() === "mermaid") {
          return (
            <div key={idx} className="guia-mermaid-box">
              <div className="guia-mermaid-header">
                <span>🔄 Diagrama de Proceso / Flujo</span>
                <span className="text-[10px] tracking-normal font-mono opacity-70">Mermaid Workflow</span>
              </div>
              <pre>
                <code>{cd.text.trim()}</code>
              </pre>
            </div>
          );
        }
        return (
          <pre key={idx}>
            <code>{cd.text}</code>
          </pre>
        );
      }
      case "blockquote": {
        const bq = token as Tokens.Blockquote;
        const m = /^\[!(info|tip|warning|abstract|faq|example)\][ \t]*(.*?)(?:\r?\n([\s\S]*))?$/i.exec(
          bq.text.trim(),
        );
        if (m) {
          const tipo = m[1].toLowerCase();
          const icono = CALLOUT_ICONS[tipo] || "ℹ️";
          const titulo = m[2].trim() || CALLOUT_TITLES[tipo] || "Nota";
          const cuerpoTokens = m[3] ? marked.lexer(m[3].trim()) : [];
          return (
            <div key={idx} className={`guia-callout guia-callout-${tipo}`}>
              <div className="guia-callout-header">
                <span>{icono}</span>
                <span>{titulo}</span>
              </div>
              {cuerpoTokens.length > 0 && (
                <div className="guia-callout-body">{renderizarTokensBloque(cuerpoTokens)}</div>
              )}
            </div>
          );
        }
        return <blockquote key={idx}>{renderizarTokensBloque(bq.tokens)}</blockquote>;
      }
      case "list": {
        const ls = token as Tokens.List;
        const Tag = ls.ordered ? "ol" : "ul";
        return (
          <Tag key={idx}>
            {ls.items.map((item, i) => (
              <li key={i}>
                {item.tokens && item.tokens.length > 0
                  ? renderizarTokensBloque(item.tokens)
                  : item.text}
              </li>
            ))}
          </Tag>
        );
      }
      case "table": {
        const tb = token as Tokens.Table;
        return (
          <div key={idx} className="guia-table-wrapper">
            <table>
              <thead>
                <tr>
                  {tb.header.map((h, i) => (
                    <th key={i} style={tb.align[i] ? { textAlign: tb.align[i] ?? undefined } : undefined}>
                      {renderizarInline(h.tokens) ?? h.text}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tb.rows.map((row, rIdx) => (
                  <tr key={rIdx}>
                    {row.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        style={tb.align[cIdx] ? { textAlign: tb.align[cIdx] ?? undefined } : undefined}
                      >
                        {renderizarInline(cell.tokens) ?? cell.text}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      case "text": {
        const tx = token as Tokens.Text;
        if (tx.tokens && tx.tokens.length > 0) {
          return <React.Fragment key={idx}>{renderizarInline(tx.tokens)}</React.Fragment>;
        }
        return <p key={idx}>{tx.text}</p>;
      }
      default:
        return null;
    }
  });
}

/**
 * Renderiza el contenido Markdown de las guías en componentes React nativos,
 * sin usar `dangerouslySetInnerHTML`.
 */
export function GuiaMarkdown({ contenido }: { contenido: string }) {
  if (!contenido) return null;

  // Separar bloques <details>...</details> opcionales al final de cada guía
  const partes: Array<{ tipo: "md"; texto: string } | { tipo: "details"; summary: string; cuerpo: string }> = [];
  const detailsRegex = /<details>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/gi;
  let ultimoIndice = 0;
  let match: RegExpExecArray | null;

  while ((match = detailsRegex.exec(contenido)) !== null) {
    if (match.index > ultimoIndice) {
      partes.push({ tipo: "md", texto: contenido.slice(ultimoIndice, match.index) });
    }
    const summaryLimpio = match[1].replace(/<\/?b>/gi, "").trim();
    partes.push({
      tipo: "details",
      summary: summaryLimpio,
      cuerpo: match[2].trim(),
    });
    ultimoIndice = match.index + match[0].length;
  }
  if (ultimoIndice < contenido.length) {
    partes.push({ tipo: "md", texto: contenido.slice(ultimoIndice) });
  }

  return (
    <div className="guia-prose max-w-none">
      {partes.map((p, idx) => {
        if (p.tipo === "details") {
          const tokens = marked.lexer(p.cuerpo);
          return (
            <details key={idx} className="guia-ficha-tecnica">
              <summary className="font-semibold">{p.summary}</summary>
              <div>{renderizarTokensBloque(tokens)}</div>
            </details>
          );
        }
        const tokens = marked.lexer(p.texto);
        return <React.Fragment key={idx}>{renderizarTokensBloque(tokens)}</React.Fragment>;
      })}
    </div>
  );
}

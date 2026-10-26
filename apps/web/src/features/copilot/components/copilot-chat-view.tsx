'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useCopilotChat } from '../hooks/use-copilot-chat';
import { CopilotKpiBanner } from './copilot-kpi-banner';
import { CopilotMessageBubble } from './copilot-message-bubble';
import { CopilotTopicsGrid } from './copilot-topics-grid';
import type { CopilotTopico } from '../types/copilot.types';

interface CopilotChatViewProps {
  onCerrar?: () => void;
  esModal?: boolean;
}

export const CopilotChatView: React.FC<CopilotChatViewProps> = ({ onCerrar, esModal = false }) => {
  const { mensajes, sugerencias, metricasActivas, cargando, enviar } = useCopilotChat();
  const [inputTexto, setInputTexto] = useState('');
  const [mostrarTopicos, setMostrarTopicos] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensajes, cargando, mostrarTopicos]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputTexto.trim() || cargando) return;
    const msg = inputTexto;
    setInputTexto('');
    setMostrarTopicos(false);
    enviar(msg);
  };

  const handleSeleccionarTopico = (prompt: string, topico?: CopilotTopico) => {
    setMostrarTopicos(false);
    enviar(prompt, topico);
  };

  // Si solo hay el mensaje de bienvenida inicial, mostramos los tópicos abiertos
  const esInicio = mensajes.length <= 1;

  return (
    <div className={`flex flex-col bg-card text-card-foreground ${esModal ? 'h-full w-full' : 'h-full w-full rounded-2xl border border-border shadow-2xl overflow-hidden'}`}>
      {/* Header del Chat */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-card/90 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-md shadow-primary/25">
            ✨
          </div>
          <div>
            <h3 className="font-semibold text-xs sm:text-sm text-foreground flex items-center gap-1.5">
              Copilot IA
              <span className="flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary border border-primary/20">
                <span className="h-1 w-1 rounded-full bg-primary animate-pulse" />
                En vivo
              </span>
            </h3>
            <p className="text-[10px] text-muted-foreground">Análisis de negocio en tiempo real</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMostrarTopicos((prev) => !prev)}
            className={`rounded-lg px-2 py-1 text-[11px] font-medium transition cursor-pointer ${
              mostrarTopicos
                ? 'bg-primary/15 text-primary border border-primary/30'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
            title="Ver tópicos de análisis"
          >
            📊 Tópicos
          </button>
          {onCerrar && (
            <button
              type="button"
              onClick={onCerrar}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
              title="Cerrar chat"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* KPI live banner */}
      <CopilotKpiBanner metricas={metricasActivas} />

      {/* Message history */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
        {mensajes.map((m, idx) => (
          <CopilotMessageBubble key={idx} mensaje={m} />
        ))}

        {/* Si es el inicio o el usuario abrió la pestaña de tópicos, se muestra la grilla */}
        {(esInicio || mostrarTopicos) && (
          <CopilotTopicsGrid onSelectTopic={handleSeleccionarTopico} disabled={cargando} />
        )}

        {cargando && (
          <div className="flex items-center gap-3 text-muted-foreground text-xs py-2 px-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted border border-border shrink-0">
              <span className="animate-spin text-primary text-xs">✦</span>
            </div>
            <p className="animate-pulse text-[11px]">Consultando métricas y analizando con IA...</p>
          </div>
        )}
      </div>

      {/* Suggestions Pills */}
      {!mostrarTopicos && sugerencias.length > 0 && (
        <div className="px-3 py-1.5 flex flex-wrap gap-1 border-t border-border/80 bg-card/90 max-h-24 overflow-y-auto">
          {sugerencias.slice(0, 3).map((sug, i) => (
            <button
              key={i}
              type="button"
              disabled={cargando}
              onClick={() => handleSeleccionarTopico(sug)}
              className="rounded-full bg-muted hover:bg-muted/80 border border-border px-2.5 py-0.5 text-[11px] text-foreground transition text-left cursor-pointer disabled:opacity-50 truncate max-w-full"
            >
              💡 {sug}
            </button>
          ))}
        </div>
      )}

      {/* Chat Input */}
      <form onSubmit={handleSubmit} className="border-t border-border p-2.5 bg-card/90">
        <div className="relative flex items-center">
          <input
            type="text"
            value={inputTexto}
            onChange={(e) => setInputTexto(e.target.value)}
            disabled={cargando}
            placeholder="Preguntale al Copilot (ej: ¿Cuáles son mis ventas?)..."
            className="w-full rounded-xl bg-background border border-border py-2.5 pl-3 pr-20 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
          />
          <button
            type="submit"
            disabled={!inputTexto.trim() || cargando}
            className="absolute right-1.5 rounded-lg bg-primary hover:opacity-90 disabled:bg-muted disabled:text-muted-foreground px-3 py-1.5 text-xs font-semibold text-primary-foreground transition shadow-sm cursor-pointer disabled:cursor-not-allowed"
          >
            Enviar
          </button>
        </div>
      </form>
    </div>
  );
};

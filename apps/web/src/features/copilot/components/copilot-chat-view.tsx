'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useCopilotChat } from '../hooks/use-copilot-chat';
import { CopilotKpiBanner } from './copilot-kpi-banner';
import { CopilotMessageBubble } from './copilot-message-bubble';
import { CopilotTopicsGrid } from './copilot-topics-grid';

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

  const handleSeleccionarTopico = (prompt: string) => {
    setMostrarTopicos(false);
    enviar(prompt);
  };

  // Si solo hay el mensaje de bienvenida inicial, mostramos los tópicos abiertos
  const esInicio = mensajes.length <= 1;

  return (
    <div className={`flex flex-col bg-zinc-950 text-zinc-100 ${esModal ? 'h-full w-full' : 'h-full w-full rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden'}`}>
      {/* Header del Chat */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3 bg-zinc-900/80 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white font-bold text-sm shadow-md shadow-emerald-500/20">
            ✨
          </div>
          <div>
            <h3 className="font-semibold text-xs sm:text-sm text-zinc-100 flex items-center gap-1.5">
              Copilot IA
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-400 border border-emerald-500/20">
                <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" />
                En vivo
              </span>
            </h3>
            <p className="text-[10px] text-zinc-400">Análisis y finanzas en tiempo real</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMostrarTopicos((prev) => !prev)}
            className={`rounded-lg px-2 py-1 text-[11px] font-medium transition cursor-pointer ${
              mostrarTopicos
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
            title="Ver tópicos de análisis"
          >
            📊 Tópicos
          </button>
          {onCerrar && (
            <button
              type="button"
              onClick={onCerrar}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition cursor-pointer"
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
          <div className="flex items-center gap-3 text-zinc-400 text-xs py-2 px-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 shrink-0">
              <span className="animate-spin text-emerald-400 text-xs">✦</span>
            </div>
            <p className="animate-pulse text-[11px]">Analizando métricas del negocio con GPT-6 Luna...</p>
          </div>
        )}
      </div>

      {/* Suggestions Pills */}
      {!mostrarTopicos && sugerencias.length > 0 && (
        <div className="px-3 py-1.5 flex flex-wrap gap-1 border-t border-zinc-900 bg-zinc-950/90 max-h-24 overflow-y-auto">
          {sugerencias.slice(0, 3).map((sug, i) => (
            <button
              key={i}
              type="button"
              disabled={cargando}
              onClick={() => handleSeleccionarTopico(sug)}
              className="rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-2.5 py-0.5 text-[11px] text-zinc-300 transition text-left cursor-pointer disabled:opacity-50 truncate max-w-full"
            >
              💡 {sug}
            </button>
          ))}
        </div>
      )}

      {/* Chat Input */}
      <form onSubmit={handleSubmit} className="border-t border-zinc-800/80 p-2.5 bg-zinc-900/60">
        <div className="relative flex items-center">
          <input
            type="text"
            value={inputTexto}
            onChange={(e) => setInputTexto(e.target.value)}
            disabled={cargando}
            placeholder="Preguntale al Copilot (ej: ¿Cuáles son mis ventas?)..."
            className="w-full rounded-xl bg-zinc-900 border border-zinc-800 py-2.5 pl-3 pr-20 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition"
          />
          <button
            type="submit"
            disabled={!inputTexto.trim() || cargando}
            className="absolute right-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 px-3 py-1.5 text-xs font-semibold text-white transition shadow-sm cursor-pointer disabled:cursor-not-allowed"
          >
            Enviar
          </button>
        </div>
      </form>
    </div>
  );
};

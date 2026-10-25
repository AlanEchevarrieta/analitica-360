'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useCopilotChat } from '../hooks/use-copilot-chat';
import { CopilotKpiBanner } from './copilot-kpi-banner';
import { CopilotMessageBubble } from './copilot-message-bubble';

interface CopilotChatViewProps {
  onCerrar?: () => void;
  esModal?: boolean;
}

export const CopilotChatView: React.FC<CopilotChatViewProps> = ({ onCerrar, esModal = false }) => {
  const { mensajes, sugerencias, metricasActivas, cargando, enviar } = useCopilotChat();
  const [inputTexto, setInputTexto] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensajes, cargando]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputTexto.trim() || cargando) return;
    const msg = inputTexto;
    setInputTexto('');
    enviar(msg);
  };

  return (
    <div className={`flex flex-col bg-zinc-950 text-zinc-100 ${esModal ? 'h-[650px] w-full max-w-2xl rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden' : 'h-full w-full'}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3.5 bg-zinc-900/50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white font-bold text-sm shadow-lg shadow-emerald-500/10">
            ✨
          </div>
          <div>
            <h3 className="font-semibold text-sm text-zinc-100 flex items-center gap-2">
              Analítica Copilot
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                GPT-6 Luna
              </span>
            </h3>
            <p className="text-xs text-zinc-400">Estratega de negocios y finanzas en tiempo real</p>
          </div>
        </div>
        {onCerrar && (
          <button
            onClick={onCerrar}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition"
          >
            ✕
          </button>
        )}
      </div>

      {/* KPI live banner */}
      <CopilotKpiBanner metricas={metricasActivas} />

      {/* Message history */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {mensajes.map((m, idx) => (
          <CopilotMessageBubble key={idx} mensaje={m} />
        ))}

        {cargando && (
          <div className="flex items-center gap-3 text-zinc-400 text-xs py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800">
              <span className="animate-spin text-emerald-400">✦</span>
            </div>
            <div className="space-y-1">
              <p className="animate-pulse">Analizando métricas y elaborando respuesta con GPT-6 Luna...</p>
            </div>
          </div>
        )}
      </div>

      {/* Suggestions Pills */}
      {sugerencias.length > 0 && (
        <div className="px-4 py-2 flex flex-wrap gap-1.5 border-t border-zinc-900 bg-zinc-950/80">
          {sugerencias.map((sug, i) => (
            <button
              key={i}
              type="button"
              disabled={cargando}
              onClick={() => enviar(sug)}
              className="rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800/80 hover:border-zinc-700 px-3 py-1 text-xs text-zinc-300 transition text-left cursor-pointer disabled:opacity-50"
            >
              💡 {sug}
            </button>
          ))}
        </div>
      )}

      {/* Chat Input */}
      <form onSubmit={handleSubmit} className="border-t border-zinc-800/80 p-3 bg-zinc-900/40">
        <div className="relative flex items-center">
          <input
            type="text"
            value={inputTexto}
            onChange={(e) => setInputTexto(e.target.value)}
            disabled={cargando}
            placeholder="Preguntale al Copilot (ej: ¿Cuáles son mis productos más rentables?)..."
            className="w-full rounded-xl bg-zinc-900 border border-zinc-800 py-3 pl-4 pr-24 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition"
          />
          <button
            type="submit"
            disabled={!inputTexto.trim() || cargando}
            className="absolute right-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 px-3.5 py-1.5 text-xs font-semibold text-white transition shadow-sm cursor-pointer disabled:cursor-not-allowed"
          >
            Enviar
          </button>
        </div>
      </form>
    </div>
  );
};

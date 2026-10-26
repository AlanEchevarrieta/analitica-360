'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useCopilotChat } from '../hooks/use-copilot-chat';
import { CopilotKpiBanner } from './copilot-kpi-banner';
import { CopilotMessageBubble } from './copilot-message-bubble';
import { CopilotTopicsGrid } from './copilot-topics-grid';
import type { CopilotTopico } from '../types/copilot.types';
import { Sparkles, Send, Cpu, LayoutGrid, X, ShieldAlert, Building2 } from 'lucide-react';

interface CopilotChatViewProps {
  onCerrar?: () => void;
  esModal?: boolean;
}

export const CopilotChatView: React.FC<CopilotChatViewProps> = ({ onCerrar, esModal = false }) => {
  const { mensajes, sugerencias, metricasActivas, cargando, enviar, tieneAccesoEmpresa, isLoaded, isSignedIn, orgId } =
    useCopilotChat();
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
    if (!inputTexto.trim() || cargando || !tieneAccesoEmpresa) return;
    const msg = inputTexto;
    setInputTexto('');
    setMostrarTopicos(false);
    enviar(msg);
  };

  const handleSeleccionarTopico = (prompt: string, topico?: CopilotTopico) => {
    if (!tieneAccesoEmpresa) return;
    setMostrarTopicos(false);
    enviar(prompt, topico);
  };

  // Si no está registrado o no tiene empresa activa, se bloquea el acceso
  if (isLoaded && !tieneAccesoEmpresa) {
    return (
      <div
        className={`flex flex-col items-center justify-center p-6 text-center bg-card/70 backdrop-blur-xl ${
          esModal ? 'h-full w-full' : 'h-full w-full flex-1 min-h-[360px]'
        }`}
      >
        <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500 shadow-lg shadow-amber-500/10">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-bold text-foreground">Acceso Restringido a Copilot IA</h3>
        <p className="mt-2 text-xs sm:text-sm text-muted-foreground max-w-sm leading-relaxed">
          Copilot IA está disponible exclusivamente para usuarios registrados con una empresa activa vinculada en
          Analítica 360.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {!isSignedIn ? (
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-md cursor-pointer"
            >
              Iniciar sesión
            </Link>
          ) : (
            <Link
              href="/elegir-empresa"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-md cursor-pointer"
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>Seleccionar empresa</span>
            </Link>
          )}
          {onCerrar && (
            <button
              type="button"
              onClick={onCerrar}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
    );
  }

  // Si solo hay el mensaje de bienvenida inicial, mostramos los tópicos abiertos
  const esInicio = mensajes.length <= 1;

  return (
    <div className={`flex flex-col bg-card/60 backdrop-blur-xl text-card-foreground ${esModal ? 'h-full w-full' : 'h-full w-full flex-1 min-h-0'}`}>
      {/* Header Futurista del Chat */}
      <div className="flex items-center justify-between border-b border-border/80 px-4 py-3 bg-card/85 backdrop-blur-md relative z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-indigo-600 to-cyan-500 text-white font-bold text-sm shadow-md shadow-primary/30">
            <Cpu className="h-4 w-4" />
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-card" />
          </div>
          <div>
            <div className="font-bold text-xs sm:text-sm text-foreground flex items-center gap-2">
              <span>Analítica Copilot</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary border border-primary/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                IA Activa
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground font-mono">Motor de Inteligencia Transaccional</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMostrarTopicos((prev) => !prev)}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 border ${
              mostrarTopicos
                ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                : 'text-muted-foreground border-border/70 hover:bg-muted hover:text-foreground'
            }`}
            title="Ver tópicos de análisis"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">Tópicos</span>
          </button>
          {onCerrar && (
            <button
              type="button"
              onClick={onCerrar}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
              title="Cerrar chat"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* KPI live banner */}
      <CopilotKpiBanner metricas={metricasActivas} />

      {/* Barra de escaneo cuando la IA está pensando */}
      {cargando && <div className="h-0.5 w-full copilot-scanline-bar bg-primary/20" />}

      {/* Message history */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-4 min-h-0">
        {mensajes.map((m, idx) => (
          <CopilotMessageBubble key={idx} mensaje={m} />
        ))}

        {/* Si es el inicio o el usuario abrió la pestaña de tópicos, se muestra la grilla */}
        {(esInicio || mostrarTopicos) && (
          <div className="pt-2">
            <CopilotTopicsGrid onSelectTopic={handleSeleccionarTopico} disabled={cargando} />
          </div>
        )}

        {/* Indicador de Pensamiento Cuántico / Futurista */}
        {cargando && (
          <div className="flex items-center gap-3 text-muted-foreground text-xs py-3 px-3 rounded-xl border border-primary/20 bg-primary/5 copilot-bubble-enter">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary copilot-node-1" />
              <span className="h-2 w-2 rounded-full bg-cyan-400 copilot-node-2" />
              <span className="h-2 w-2 rounded-full bg-indigo-500 copilot-node-3" />
            </div>
            <p className="text-[11px] font-mono font-medium text-foreground/80 tracking-wide">
              ✦ Procesando análisis y métricas con Analítica IA...
            </p>
          </div>
        )}
      </div>

      {/* Suggestions Pills */}
      {!mostrarTopicos && sugerencias.length > 0 && (
        <div className="px-3.5 py-2 flex flex-wrap gap-1.5 border-t border-border/70 bg-card/80 backdrop-blur-md max-h-24 overflow-y-auto shrink-0">
          {sugerencias.slice(0, 3).map((sug, i) => (
            <button
              key={i}
              type="button"
              disabled={cargando}
              onClick={() => handleSeleccionarTopico(sug)}
              className="rounded-full bg-muted/80 hover:bg-primary/10 hover:border-primary/40 border border-border/80 px-3 py-1 text-[11px] text-foreground transition-all text-left cursor-pointer disabled:opacity-50 truncate max-w-full flex items-center gap-1 shadow-2xs"
            >
              <Sparkles className="h-3 w-3 text-primary shrink-0" />
              <span className="truncate">{sug}</span>
            </button>
          ))}
        </div>
      )}

      {/* Chat Input con estilo Futurista */}
      <form onSubmit={handleSubmit} className="border-t border-border/80 p-2.5 sm:p-3 bg-card/90 backdrop-blur-md shrink-0">
        <div className="relative flex items-center copilot-input-box rounded-xl border border-border/90 bg-background/90 shadow-inner">
          <input
            type="text"
            value={inputTexto}
            onChange={(e) => setInputTexto(e.target.value)}
            disabled={cargando || !tieneAccesoEmpresa}
            placeholder={
              tieneAccesoEmpresa
                ? 'Escribí una consulta estratégica a Analítica IA...'
                : 'Seleccioná tu empresa para consultar a Analítica IA...'
            }
            className="w-full bg-transparent py-2.5 sm:py-3 pl-3.5 pr-24 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none transition"
          />
          <button
            type="submit"
            disabled={!inputTexto.trim() || cargando || !tieneAccesoEmpresa}
            className="absolute right-1.5 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-500 disabled:from-muted disabled:to-muted disabled:text-muted-foreground px-3.5 py-1.5 text-xs font-semibold text-white transition-all shadow-sm cursor-pointer disabled:cursor-not-allowed"
          >
            <span>Consultar</span>
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
};

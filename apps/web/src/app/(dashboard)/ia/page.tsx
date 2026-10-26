import type { Metadata } from 'next';
import { CopilotChatView } from '@/features/copilot/components/copilot-chat-view';
import { Sparkles, Bot, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Analítica Copilot IA · Analítica 360',
  description: 'Asistente de inteligencia artificial y análisis estratégico para tu negocio',
};

export default function IaPage() {
  return (
    <div className="flex h-[calc(100dvh-6.2rem)] sm:h-[calc(100dvh-7.2rem)] flex-col max-w-5xl mx-auto w-full min-w-0">
      {/* Header armonizado con tokens de Analítica 360 */}
      <div className="mb-2 sm:mb-3 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary border border-primary/30 text-sm shadow-xs">
              <Sparkles className="h-4 w-4" />
            </span>
            <span>Analítica Copilot</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary border border-primary/25">
              Analítica IA
            </span>
          </h1>
          <p className="text-xs text-muted-foreground hidden sm:block">
            Diagnóstico en tiempo real de ventas, rentabilidad, deudores y alertas operativas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-500 shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="hidden xs:inline">Conexión Segura</span>
          </span>
        </div>
      </div>

      {/* Contenedor Futurista con Glow y Adaptabilidad Mobile */}
      <div className="flex-1 rounded-2xl border border-primary/25 bg-card/70 backdrop-blur-xl overflow-hidden shadow-2xl flex flex-col min-h-0 copilot-container">
        <CopilotChatView />
      </div>
    </div>
  );
}

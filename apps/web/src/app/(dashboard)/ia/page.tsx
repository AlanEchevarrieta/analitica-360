import type { Metadata } from 'next';
import { CopilotChatView } from '@/features/copilot/components/copilot-chat-view';

export const metadata: Metadata = {
  title: 'Copilot IA · Analítica 360',
  description: 'Asistente de inteligencia artificial y análisis estratégico para tu negocio',
};

export default function IaPage() {
  return (
    <div className="flex h-[calc(100vh-8.5rem)] flex-col max-w-5xl mx-auto w-full">
      <div className="mb-3">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 text-sm">
            ✨
          </span>
          <span>Analítica Copilot</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary border border-primary/20">
            Analítica IA
          </span>
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Analizá en tiempo real tus ventas, rentabilidad, deudores y alertas de stock con IA.
        </p>
      </div>

      <div className="flex-1 rounded-2xl border border-border bg-card overflow-hidden shadow-2xl flex flex-col">
        <CopilotChatView />
      </div>
    </div>
  );
}

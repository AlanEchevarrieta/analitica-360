import type { Metadata } from 'next';
import { CopilotChatView } from '@/features/copilot/components/copilot-chat-view';

export const metadata: Metadata = {
  title: 'Copilot IA · Analítica 360',
  description: 'Asistente de inteligencia artificial y análisis estratégico para tu negocio',
};

export default function CopilotPage() {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col p-4 md:p-6 max-w-5xl mx-auto w-full">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 text-sm">
            ✨
          </span>
          <span>Analítica Copilot</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Consultá tus métricas, diagnosticá rentabilidad y proyectá ventas con Analítica IA.
        </p>
      </div>

      <div className="flex-1 rounded-2xl border border-border bg-card overflow-hidden shadow-xl">
        <CopilotChatView />
      </div>
    </div>
  );
}

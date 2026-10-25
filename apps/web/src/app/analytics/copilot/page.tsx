import type { Metadata } from 'next';
import { CopilotChatView } from '@/features/copilot/components/copilot-chat-view';

export const metadata: Metadata = {
  title: 'Copilot IA · Analítica 360',
  description: 'Asistente de inteligencia artificial y análisis estratégico con GPT-6 Luna',
};

export default function CopilotPage() {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col p-4 md:p-6 max-w-5xl mx-auto w-full">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2.5">
          <span>✨</span>
          <span>Analítica Copilot</span>
        </h1>
        <p className="text-sm text-zinc-400">
          Consultá tus métricas, diagnosticá rentabilidad y proyectá ventas con GPT-6 Luna.
        </p>
      </div>

      <div className="flex-1 rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-xl">
        <CopilotChatView />
      </div>
    </div>
  );
}

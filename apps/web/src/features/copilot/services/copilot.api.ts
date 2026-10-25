import { apiFetch } from '@/lib/api-client';
import type { CopilotChatResponse } from '../types/copilot.types';

export async function enviarMensajeCopilot(
  token: string | null,
  mensaje: string,
  historial: { rol: 'user' | 'assistant'; contenido: string }[] = [],
): Promise<CopilotChatResponse> {
  return apiFetch<CopilotChatResponse>('/copilot/chat', token, {
    method: 'POST',
    body: JSON.stringify({ mensaje, historial }),
  });
}

export async function obtenerSugerenciasCopilot(token: string | null): Promise<string[]> {
  return apiFetch<string[]>('/copilot/sugerencias', token);
}

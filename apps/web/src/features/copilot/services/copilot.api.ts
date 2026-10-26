import { apiFetch } from '@/lib/api-client';
import type { CopilotChatResponse, CopilotTopico } from '../types/copilot.types';

export async function enviarMensajeCopilot(
  token: string | null,
  mensaje: string,
  historial: { rol: 'user' | 'assistant'; contenido: string }[] = [],
  topico?: CopilotTopico,
): Promise<CopilotChatResponse> {
  return apiFetch<CopilotChatResponse>('/copilot/chat', token, {
    method: 'POST',
    body: JSON.stringify({ mensaje, historial, topico }),
  });
}

export async function obtenerSugerenciasCopilot(token: string | null): Promise<string[]> {
  return apiFetch<string[]>('/copilot/sugerencias', token);
}

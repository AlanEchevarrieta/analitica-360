'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { enviarMensajeCopilot, obtenerSugerenciasCopilot } from '../services/copilot.api';
import type { CopilotMensaje, MetricasNegocio, CopilotTopico } from '../types/copilot.types';

export function useCopilotChat() {
  const { getToken } = useAuth();
  const [mensajes, setMensajes] = useState<CopilotMensaje[]>([
    {
      rol: 'assistant',
      contenido:
        '👋 ¡Hola! Soy **Analítica Copilot** (impulsado por GPT-6 Luna). Estoy conectado a los datos en vivo de tu negocio para ayudarte a optimizar ventas, costos y stock. ¿En qué te puedo ayudar hoy?',
      fecha: new Date().toISOString(),
    },
  ]);
  const [sugerencias, setSugerencias] = useState<string[]>([
    '¿Cómo vienen mis ventas de los últimos 30 días?',
    '¿Cuáles son mis 5 productos más vendidos?',
    '¿Tengo productos en stock crítico?',
  ]);
  const [metricasActivas, setMetricasActivas] = useState<MetricasNegocio | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let montado = true;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const sugs = await obtenerSugerenciasCopilot(token);
        if (montado && sugs?.length) {
          setSugerencias(sugs);
        }
      } catch {
        // Usa sugerencias por defecto si falla la llamada
      }
    })();
    return () => {
      montado = false;
    };
  }, [getToken]);

  const enviar = useCallback(
    async (texto: string, topico?: CopilotTopico) => {
      const limpio = texto.trim();
      if (!limpio || cargando) return;

      setError(null);
      setCargando(true);

      const mensajeUsuario: CopilotMensaje = {
        rol: 'user',
        contenido: limpio,
        fecha: new Date().toISOString(),
        topico,
      };

      setMensajes((prev) => [...prev, mensajeUsuario]);

      try {
        const token = await getToken();
        const historialParaApi = mensajes.slice(-10).map((m) => ({
          rol: m.rol,
          contenido: m.contenido,
        }));

        const res = await enviarMensajeCopilot(token, limpio, historialParaApi, topico);

        const mensajeAsistente: CopilotMensaje = {
          rol: 'assistant',
          contenido: res.respuesta,
          fecha: new Date().toISOString(),
          topico,
        };

        setMensajes((prev) => [...prev, mensajeAsistente]);
        if (res.metricasUtilizadas) {
          setMetricasActivas(res.metricasUtilizadas);
        }
        if (res.sugerenciasSiguientes?.length) {
          setSugerencias(res.sugerenciasSiguientes);
        }
      } catch (err) {
        const msg = (err as Error).message || 'No pudimos conectar con el Copilot de IA.';
        setError(msg);
        setMensajes((prev) => [
          ...prev,
          {
            rol: 'assistant',
            contenido: `⚠️ **Ocurrió un error temporal:** ${msg}. Por favor intentá nuevamente.`,
            fecha: new Date().toISOString(),
          },
        ]);
      } finally {
        setCargando(false);
      }
    },
    [cargando, getToken, mensajes],
  );

  return {
    mensajes,
    sugerencias,
    metricasActivas,
    cargando,
    error,
    enviar,
  };
}

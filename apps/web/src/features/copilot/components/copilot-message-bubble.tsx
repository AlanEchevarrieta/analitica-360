'use client';

import React from 'react';
import type { CopilotMensaje } from '../types/copilot.types';

interface CopilotMessageBubbleProps {
  mensaje: CopilotMensaje;
}

export const CopilotMessageBubble: React.FC<CopilotMessageBubbleProps> = ({ mensaje }) => {
  const esUsuario = mensaje.rol === 'user';

  // Renderizado simple y seguro de markdown (negritas y listas)
  const formatearTexto = (texto: string) => {
    return texto.split('\n').map((linea, i) => {
      const partes = linea.split(/(\*\*.*?\*\*)/g);
      return (
        <span key={i} className="block min-h-[1.25rem]">
          {partes.map((p, j) => {
            if (p.startsWith('**') && p.endsWith('**')) {
              return <strong key={j} className="font-semibold text-foreground">{p.slice(2, -2)}</strong>;
            }
            return p;
          })}
        </span>
      );
    });
  };

  return (
    <div className={`flex w-full gap-3 ${esUsuario ? 'justify-end' : 'justify-start'}`}>
      {!esUsuario && (
        <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary font-bold text-xs">
          IA
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
          esUsuario
            ? 'bg-primary text-primary-foreground rounded-br-none shadow-md shadow-primary/20'
            : 'bg-muted/80 border border-border text-foreground rounded-bl-none'
        }`}
      >
        <div className="space-y-1">{formatearTexto(mensaje.contenido)}</div>
      </div>
    </div>
  );
};

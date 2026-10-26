'use client';

import React from 'react';
import type { CopilotMensaje } from '../types/copilot.types';
import { Bot, Sparkles, User } from 'lucide-react';

interface CopilotMessageBubbleProps {
  mensaje: CopilotMensaje;
}

export const CopilotMessageBubble: React.FC<CopilotMessageBubbleProps> = ({ mensaje }) => {
  const esUsuario = mensaje.rol === 'user';

  // Renderizado simple y seguro de markdown (negritas, listas y cursivas)
  const formatearTexto = (texto: string) => {
    return texto.split('\n').map((linea, i) => {
      // Detección de citas / pie de respuesta
      if (linea.startsWith('> ✨') || linea.startsWith('>')) {
        return (
          <span key={i} className="block text-[11px] font-mono text-primary/80 italic pt-1 border-t border-border/40 mt-1">
            {linea.replace(/^>\s*/, '')}
          </span>
        );
      }

      const partes = linea.split(/(\*\*.*?\*\*|\*.*?\*)/g);
      return (
        <span key={i} className="block min-h-[1.25rem]">
          {partes.map((p, j) => {
            if (p.startsWith('**') && p.endsWith('**')) {
              return <strong key={j} className="font-semibold text-foreground">{p.slice(2, -2)}</strong>;
            }
            if (p.startsWith('*') && p.endsWith('*')) {
              return <em key={j} className="text-muted-foreground">{p.slice(1, -1)}</em>;
            }
            return p;
          })}
        </span>
      );
    });
  };

  return (
    <div className={`flex w-full gap-2.5 sm:gap-3 copilot-bubble-enter ${esUsuario ? 'justify-end' : 'justify-start'}`}>
      {!esUsuario && (
        <div className="relative flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/30 text-primary font-bold text-xs shadow-xs">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
      )}

      <div
        className={`max-w-[92%] sm:max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed transition-all ${
          esUsuario
            ? 'bg-gradient-to-r from-primary to-indigo-600 text-white rounded-tr-xs shadow-md shadow-primary/25'
            : 'bg-card/90 border border-primary/20 text-foreground rounded-tl-xs shadow-sm backdrop-blur-md'
        }`}
      >
        <div className="space-y-1">{formatearTexto(mensaje.contenido)}</div>
      </div>

      {esUsuario && (
        <div className="hidden xs:flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-xl bg-muted border border-border text-muted-foreground">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  );
};

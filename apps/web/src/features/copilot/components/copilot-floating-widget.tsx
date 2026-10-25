'use client';

import React, { useState, useEffect } from 'react';
import { CopilotChatView } from './copilot-chat-view';

export const CopilotFloatingWidget: React.FC = () => {
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setAbierto((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      {/* Botón Flotante */}
      <button
        onClick={() => setAbierto((prev) => !prev)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 px-4 py-3 text-sm font-semibold text-white shadow-xl shadow-emerald-950/40 border border-emerald-400/30 transition-all hover:scale-105 cursor-pointer active:scale-95"
        title="Abrir Copilot IA (⌘J)"
      >
        <span className="flex h-2 w-2 rounded-full bg-emerald-200 animate-ping" />
        <span className="text-base">✨</span>
        <span>Copilot IA</span>
        <span className="hidden sm:inline-block rounded bg-black/30 px-1.5 py-0.5 text-[10px] text-emerald-200 font-mono">
          ⌘J
        </span>
      </button>

      {/* Modal / Dialog */}
      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl">
            <CopilotChatView esModal onCerrar={() => setAbierto(false)} />
          </div>
        </div>
      )}
    </>
  );
};

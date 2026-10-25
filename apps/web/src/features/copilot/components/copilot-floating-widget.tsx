'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { CopilotChatView } from './copilot-chat-view';

export const CopilotFloatingWidget: React.FC = () => {
  const [abierto, setAbierto] = useState(false);
  const pathname = usePathname();

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

  // Ocultar únicamente en los formularios de autenticación para no estorbar
  const esRutaAuth = pathname?.startsWith('/sign-in') || pathname?.startsWith('/sign-up');
  if (esRutaAuth) {
    return null;
  }

  return (
    <>
      {/* Ventana de Chat Flotante Anclada a la Esquina Inferior Izquierda */}
      {abierto && (
        <div className="fixed bottom-24 left-4 sm:left-6 z-[999999] w-[calc(100vw-2rem)] sm:w-[420px] h-[580px] max-h-[82vh] rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl shadow-black/95 flex flex-col overflow-hidden backdrop-blur-xl animate-in slide-in-from-bottom-5 fade-in duration-200">
          <CopilotChatView esModal onCerrar={() => setAbierto(false)} />
        </div>
      )}

      {/* Bolita Flotante Circular en la Esquina Inferior Izquierda con z-index máximo */}
      <button
        type="button"
        onClick={() => setAbierto((prev) => !prev)}
        className="fixed bottom-6 left-6 z-[999999] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 text-white shadow-2xl shadow-emerald-500/50 border-2 border-emerald-300/50 transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer group"
        title={abierto ? 'Cerrar Copilot IA' : 'Abrir Copilot IA (⌘J)'}
        aria-label="Abrir Copilot IA"
      >
        {abierto ? (
          <span className="text-xl font-bold transition-transform duration-200 group-hover:rotate-90">
            ✕
          </span>
        ) : (
          <div className="relative flex items-center justify-center">
            {/* Indicador pulsante verde de estado activo */}
            <span className="absolute -top-3.5 -right-3.5 flex h-4 w-4 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-90" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 border border-zinc-950" />
            </span>
            <span className="text-2xl transition-transform duration-300 group-hover:scale-110">
              ✨
            </span>
          </div>
        )}
      </button>
    </>
  );
};

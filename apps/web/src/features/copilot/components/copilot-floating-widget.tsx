'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { CopilotChatView } from './copilot-chat-view';

export const CopilotFloatingWidget: React.FC = () => {
  const [abierto, setAbierto] = useState(false);
  const pathname = usePathname();
  const { isSignedIn, isLoaded } = useAuth();

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

  // Ocultar en páginas de autenticación o antes de cargar la sesión
  const esRutaAuth = pathname?.startsWith('/sign-in') || pathname?.startsWith('/sign-up');
  if (esRutaAuth || (isLoaded && !isSignedIn)) {
    return null;
  }

  return (
    <>
      {/* Ventana de Chat Flotante Anclada sobre la bolita */}
      {abierto && (
        <div className="fixed bottom-24 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[420px] h-[580px] max-h-[80vh] rounded-2xl border border-zinc-800 bg-zinc-950/95 shadow-2xl shadow-black/90 flex flex-col overflow-hidden backdrop-blur-xl animate-in slide-in-from-bottom-5 fade-in duration-200">
          <CopilotChatView esModal onCerrar={() => setAbierto(false)} />
        </div>
      )}

      {/* Bolita Flotante Circular (Estilo Chat Flotante) */}
      <button
        onClick={() => setAbierto((prev) => !prev)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 text-white shadow-xl shadow-emerald-500/25 border border-emerald-400/40 transition-all duration-300 hover:scale-110 hover:shadow-emerald-500/40 active:scale-95 cursor-pointer group"
        title={abierto ? 'Cerrar Copilot IA' : 'Abrir Copilot IA (⌘J)'}
        aria-label="Copilot IA"
      >
        {abierto ? (
          <span className="text-xl font-bold transition-transform duration-200 group-hover:rotate-90">
            ✕
          </span>
        ) : (
          <div className="relative flex items-center justify-center">
            {/* Indicador pulsante de estado en vivo */}
            <span className="absolute -top-3.5 -right-3.5 flex h-3.5 w-3.5 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
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

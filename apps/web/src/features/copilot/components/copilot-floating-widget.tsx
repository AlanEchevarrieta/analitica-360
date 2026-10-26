'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { CopilotChatView } from './copilot-chat-view';

export const CopilotFloatingWidget: React.FC = () => {
  const [abierto, setAbierto] = useState(false);
  const pathname = usePathname();
  const { isLoaded, isSignedIn, orgId } = useAuth();

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

  // Exclusivo: Solo usuarios autenticados con empresa (organización) activa
  if (!isLoaded || !isSignedIn || !orgId) {
    return null;
  }

  // Si el usuario ya está en la pantalla principal de Copilot IA (/ia), no superponer el widget flotante
  if (pathname === '/ia') {
    return null;
  }

  // Rutas públicas o de onboarding donde no debe figurar la IA flotante
  const esRutaExcluida =
    pathname === '/' ||
    pathname?.startsWith('/sign-in') ||
    pathname?.startsWith('/sign-up') ||
    pathname?.startsWith('/bienvenida') ||
    pathname?.startsWith('/elegir-empresa') ||
    pathname?.startsWith('/terminos') ||
    pathname?.startsWith('/privacidad');
  if (esRutaExcluida) {
    return null;
  }

  return (
    <>
      {/* Ventana de Chat Flotante Anclada a la Esquina Inferior Derecha */}
      {abierto && (
        <div className="fixed bottom-24 right-4 sm:right-6 z-[999999] w-[calc(100vw-2rem)] sm:w-[420px] h-[580px] max-h-[82vh] rounded-2xl border border-border bg-card/95 text-card-foreground shadow-2xl shadow-black/60 flex flex-col overflow-hidden backdrop-blur-xl animate-in slide-in-from-bottom-5 fade-in duration-200">
          <CopilotChatView esModal onCerrar={() => setAbierto(false)} />
        </div>
      )}

      {/* Bolita Flotante Circular en la Esquina Inferior Derecha respetando el manual de marca */}
      <button
        type="button"
        onClick={() => setAbierto((prev) => !prev)}
        className="fixed bottom-6 right-6 z-[999999] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl shadow-primary/35 border-2 border-primary-foreground/20 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer group"
        title={abierto ? 'Cerrar Copilot IA' : 'Abrir Copilot IA (⌘J)'}
        aria-label="Abrir Copilot IA"
      >
        {abierto ? (
          <span className="text-xl font-bold transition-transform duration-200 group-hover:rotate-90">
            ✕
          </span>
        ) : (
          <div className="relative flex items-center justify-center">
            {/* Indicador pulsante de estado activo con tokens de marca */}
            <span className="absolute -top-3.5 -right-3.5 flex h-4 w-4 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-80" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary-foreground border border-primary" />
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

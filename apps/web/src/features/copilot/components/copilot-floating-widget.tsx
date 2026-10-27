'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { cn } from 'cn';
import { CopilotChatView } from './copilot-chat-view';

export const CopilotFloatingWidget: React.FC = () => {
  const [abierto, setAbierto] = useState(false);
  const [posicion, setPosicion] = useState<{ x: number; y: number } | null>(null);
  const pathname = usePathname();
  const { isLoaded, isSignedIn, orgId } = useAuth();

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dragInfo = useRef<{
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
    hasDragged: boolean;
  } | null>(null);

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

  // Mantener la posición dentro del viewport si la pantalla cambia de tamaño
  useEffect(() => {
    const handleResize = () => {
      setPosicion((prev) => {
        if (!prev) return null;
        const btn = buttonRef.current;
        const w = btn?.offsetWidth ?? 44;
        const h = btn?.offsetHeight ?? 44;
        const maxX = window.innerWidth - w - 8;
        const maxY = window.innerHeight - h - 8;
        return {
          x: Math.min(Math.max(8, prev.x), Math.max(8, maxX)),
          y: Math.min(Math.max(8, prev.y), Math.max(8, maxY)),
        };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Controladores de arrastre mediante Pointer Events (unifica táctil y mouse)
  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    const btn = buttonRef.current;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    dragInfo.current = {
      startX: e.clientX,
      startY: e.clientY,
      startLeft: rect.left,
      startTop: rect.top,
      hasDragged: false,
    };

    try {
      btn.setPointerCapture(e.pointerId);
    } catch {
      // Ignorar si el navegador no permite capturar
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragInfo.current) return;
    const dx = e.clientX - dragInfo.current.startX;
    const dy = e.clientY - dragInfo.current.startY;

    if (!dragInfo.current.hasDragged && Math.hypot(dx, dy) > 5) {
      dragInfo.current.hasDragged = true;
    }

    if (dragInfo.current.hasDragged) {
      const btn = buttonRef.current;
      const w = btn?.offsetWidth ?? 44;
      const h = btn?.offsetHeight ?? 44;
      const maxX = window.innerWidth - w - 8;
      const maxY = window.innerHeight - h - 8;

      const newX = Math.min(Math.max(8, dragInfo.current.startLeft + dx), Math.max(8, maxX));
      const newY = Math.min(Math.max(8, dragInfo.current.startTop + dy), Math.max(8, maxY));

      setPosicion({ x: newX, y: newY });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragInfo.current) return;
    const { hasDragged } = dragInfo.current;
    dragInfo.current = null;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignorar si ya se liberó
    }

    // Si fue un tap o clic (no se arrastró), conmutamos apertura del chat
    if (!hasDragged) {
      setAbierto((prev) => !prev);
    }
  };

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

  const buttonStyle: React.CSSProperties = posicion
    ? {
        position: 'fixed',
        left: `${posicion.x}px`,
        top: `${posicion.y}px`,
        bottom: 'auto',
        right: 'auto',
        touchAction: 'none',
      }
    : {
        touchAction: 'none',
      };

  return (
    <>
      {/* Ventana de Chat Flotante Adaptable para Mobile y Desktop */}
      {abierto && (
        <div className="fixed bottom-16 sm:bottom-24 right-2 sm:right-6 z-[999999] w-[calc(100vw-1rem)] sm:w-[420px] h-[520px] sm:h-[580px] max-h-[80vh] rounded-2xl border border-border bg-card/95 text-card-foreground shadow-2xl shadow-black/60 flex flex-col overflow-hidden backdrop-blur-xl animate-in slide-in-from-bottom-5 fade-in duration-200">
          <CopilotChatView esModal onCerrar={() => setAbierto(false)} />
        </div>
      )}

      {/* Botón Flotante Circular: Arrastrable y más compacto en mobile */}
      <button
        ref={buttonRef}
        type="button"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          dragInfo.current = null;
        }}
        style={buttonStyle}
        className={cn(
          'fixed z-[999999] flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/35 border-2 border-primary-foreground/20 cursor-grab active:cursor-grabbing select-none group transition-transform active:scale-95',
          // Tamaño: más pequeño y discreto en mobile (44px / h-11 w-11), tamaño estándar en desktop (56px / h-14 w-14)
          'h-11 w-11 sm:h-14 sm:w-14',
          // Posición fija por defecto en la esquina inferior si no fue arrastrado
          !posicion && 'bottom-4 right-4 sm:bottom-6 sm:right-6'
        )}
        title={abierto ? 'Cerrar Copilot IA' : 'Copilot IA (arrastrá para mover, ⌘J)'}
        aria-label="Abrir Copilot IA"
      >
        {abierto ? (
          <span className="text-base sm:text-xl font-bold transition-transform duration-200 group-hover:rotate-90 pointer-events-none">
            ✕
          </span>
        ) : (
          <div className="relative flex items-center justify-center pointer-events-none">
            {/* Indicador pulsante de estado activo */}
            <span className="absolute -top-1.5 -right-1.5 sm:-top-2 sm:-right-2 flex h-3 w-3 sm:h-4 sm:w-4 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-80" />
              <span className="relative inline-flex h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-primary-foreground border border-primary" />
            </span>
            <span className="text-lg sm:text-2xl transition-transform duration-300 group-hover:scale-110">
              ✨
            </span>
          </div>
        )}
      </button>
    </>
  );
};

import { Analitica360Client } from './client.js';
import { Analitica360Error } from './errors.js';
import { Analitica360Widget, initTurnosWidget } from './widget/index.js';

// Exponer en window para inclusión por script tag
declare global {
  interface Window {
    Analitica360?: {
      Client: typeof Analitica360Client;
      Widget: typeof Analitica360Widget;
      Error: typeof Analitica360Error;
      init: typeof initTurnosWidget;
    };
  }
}

if (typeof window !== 'undefined') {
  window.Analitica360 = {
    Client: Analitica360Client,
    Widget: Analitica360Widget,
    Error: Analitica360Error,
    init: initTurnosWidget,
  };

  // Auto-inicialización si el script tiene atributos data-*
  document.addEventListener('DOMContentLoaded', () => {
    const scriptEl = document.querySelector('script[data-empresa]') as HTMLScriptElement | null;
    if (scriptEl) {
      const empresaId = scriptEl.getAttribute('data-empresa');
      if (empresaId) {
        const baseUrl = scriptEl.getAttribute('data-api-url') || undefined;
        const themeColor = scriptEl.getAttribute('data-color') || undefined;
        const position = (scriptEl.getAttribute('data-position') as 'bottom-right' | 'bottom-left') || 'bottom-right';
        const buttonText = scriptEl.getAttribute('data-button-text') || 'Reservar Turno';
        const title = scriptEl.getAttribute('data-title') || 'Reserva de Turno Online';

        initTurnosWidget({
          empresaId,
          baseUrl,
          themeColor,
          position,
          buttonText,
          title,
        });
      }
    }
  });
}

export { Analitica360Client, Analitica360Error, Analitica360Widget, initTurnosWidget };

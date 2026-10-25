'use client';

import React from 'react';

interface CopilotTopicsGridProps {
  onSelectTopic: (prompt: string) => void;
  disabled?: boolean;
}

const TOPICOS = [
  {
    icono: '📈',
    titulo: 'Ventas y Facturación',
    desc: 'Total facturado, ticket promedio y comparación mensual.',
    prompt: '¿Cómo vienen mis ventas de los últimos 30 días y mi ticket promedio?',
  },
  {
    icono: '🏆',
    titulo: 'Productos Más Vendidos',
    desc: 'Tus 5 productos líderes en volumen e ingresos.',
    prompt: '¿Cuáles son mis 5 productos más vendidos y cuánto representan?',
  },
  {
    icono: '📦',
    titulo: 'Alertas de Stock',
    desc: 'Productos en riesgo de quiebre o stock bajo.',
    prompt: '¿Qué productos están en stock crítico y debería reponer primero?',
  },
  {
    icono: '💳',
    titulo: 'Cobranzas y Deudas',
    desc: 'Saldos pendientes en cuentas corrientes de clientes.',
    prompt: '¿Cuánto dinero tengo pendiente de cobro en cuentas corrientes?',
  },
  {
    icono: '💵',
    titulo: 'Dólar e Inflación',
    desc: 'Cotización del Dólar Blue y protección de márgenes.',
    prompt: '¿A cuánto está el Dólar Blue hoy y cómo afecta mis precios y costos?',
  },
];

export const CopilotTopicsGrid: React.FC<CopilotTopicsGridProps> = ({ onSelectTopic, disabled = false }) => {
  return (
    <div className="space-y-2 py-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Tópicos de Análisis Rápido
        </span>
        <span className="text-[10px] text-zinc-500">Seleccioná uno para analizar</span>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {TOPICOS.map((t, idx) => (
          <button
            key={idx}
            type="button"
            disabled={disabled}
            onClick={() => onSelectTopic(t.prompt)}
            className="flex items-center gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/60 hover:bg-zinc-800/80 hover:border-zinc-700/80 p-2.5 text-left transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50 group"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800 border border-zinc-700/50 text-base shadow-sm group-hover:bg-zinc-700/70 transition">
              {t.icono}
            </span>
            <div className="flex-1 min-w-0">
              <h5 className="font-medium text-xs text-zinc-200 group-hover:text-emerald-400 transition truncate">
                {t.titulo}
              </h5>
              <p className="text-[11px] text-zinc-400 truncate">{t.desc}</p>
            </div>
            <span className="text-zinc-500 group-hover:text-zinc-300 text-xs transition">→</span>
          </button>
        ))}
      </div>
    </div>
  );
};

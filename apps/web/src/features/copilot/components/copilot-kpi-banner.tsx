'use client';

import React from 'react';
import type { MetricasNegocio } from '../types/copilot.types';

interface CopilotKpiBannerProps {
  metricas: MetricasNegocio | null;
}

export const CopilotKpiBanner: React.FC<CopilotKpiBannerProps> = ({ metricas }) => {
  if (!metricas) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 bg-zinc-900/60 px-4 py-2 text-xs text-zinc-400">
      <span className="font-medium text-emerald-400 flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Métricas en vivo
      </span>
      {metricas.totalVentasPeriodo !== undefined && (
        <span className="rounded bg-zinc-800/80 px-2 py-0.5 border border-zinc-700/50">
          Ventas 30d: <strong className="text-zinc-200">${metricas.totalVentasPeriodo.toLocaleString('es-AR')}</strong>
        </span>
      )}
      {metricas.ticketPromedio !== undefined && (
        <span className="rounded bg-zinc-800/80 px-2 py-0.5 border border-zinc-700/50">
          Ticket: <strong className="text-zinc-200">${metricas.ticketPromedio.toLocaleString('es-AR')}</strong>
        </span>
      )}
      {metricas.dolarReferencia && (
        <span className="rounded bg-zinc-800/80 px-2 py-0.5 border border-zinc-700/50">
          Blue: <strong className="text-zinc-200">${metricas.dolarReferencia.valor}</strong>
        </span>
      )}
    </div>
  );
};

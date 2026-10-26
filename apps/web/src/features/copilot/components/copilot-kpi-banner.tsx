'use client';

import React from 'react';
import type { MetricasNegocio } from '../types/copilot.types';
import { Activity } from 'lucide-react';

interface CopilotKpiBannerProps {
  metricas: MetricasNegocio | null;
}

export const CopilotKpiBanner: React.FC<CopilotKpiBannerProps> = ({ metricas }) => {
  if (!metricas) return null;

  return (
    <div className="flex items-center gap-2 border-b border-border/80 bg-muted/20 px-3 sm:px-4 py-2 text-xs text-muted-foreground overflow-x-auto shrink-0 scrollbar-none">
      <span className="font-semibold text-primary flex items-center gap-1.5 shrink-0 text-[11px]">
        <Activity className="h-3 w-3 text-emerald-400" />
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="hidden xs:inline">Telemetría</span>
      </span>

      {metricas.totalVentasPeriodo !== undefined && (
        <span className="rounded-md bg-card/80 px-2 py-0.5 border border-border/80 text-[11px] shrink-0 shadow-2xs">
          Ventas 30d: <strong className="text-foreground">${metricas.totalVentasPeriodo.toLocaleString('es-AR')}</strong>
        </span>
      )}

      {metricas.ticketPromedio !== undefined && (
        <span className="rounded-md bg-card/80 px-2 py-0.5 border border-border/80 text-[11px] shrink-0 shadow-2xs">
          Ticket: <strong className="text-foreground">${metricas.ticketPromedio.toLocaleString('es-AR')}</strong>
        </span>
      )}

      {metricas.dolarReferencia && (
        <span className="rounded-md bg-card/80 px-2 py-0.5 border border-border/80 text-[11px] shrink-0 shadow-2xs">
          Dólar Blue: <strong className="text-foreground">${metricas.dolarReferencia.valor}</strong>
        </span>
      )}
    </div>
  );
};

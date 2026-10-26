'use client';

import React from 'react';
import type { MetricasNegocio } from '../types/copilot.types';

interface CopilotKpiBannerProps {
  metricas: MetricasNegocio | null;
}

export const CopilotKpiBanner: React.FC<CopilotKpiBannerProps> = ({ metricas }) => {
  if (!metricas) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card/60 px-4 py-2 text-xs text-muted-foreground">
      <span className="font-medium text-primary flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        Métricas en vivo
      </span>
      {metricas.totalVentasPeriodo !== undefined && (
        <span className="rounded bg-muted px-2 py-0.5 border border-border/80">
          Ventas 30d: <strong className="text-foreground">${metricas.totalVentasPeriodo.toLocaleString('es-AR')}</strong>
        </span>
      )}
      {metricas.ticketPromedio !== undefined && (
        <span className="rounded bg-muted px-2 py-0.5 border border-border/80">
          Ticket: <strong className="text-foreground">${metricas.ticketPromedio.toLocaleString('es-AR')}</strong>
        </span>
      )}
      {metricas.dolarReferencia && (
        <span className="rounded bg-muted px-2 py-0.5 border border-border/80">
          Blue: <strong className="text-foreground">${metricas.dolarReferencia.valor}</strong>
        </span>
      )}
    </div>
  );
};

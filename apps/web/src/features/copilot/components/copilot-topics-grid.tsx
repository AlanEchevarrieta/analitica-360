'use client';

import React from 'react';
import type { CopilotTopico } from '../types/copilot.types';

interface CopilotTopicsGridProps {
  onSelectTopic: (prompt: string, topico: CopilotTopico) => void;
  disabled?: boolean;
}

interface TopicoItem {
  id: CopilotTopico;
  icono: string;
  titulo: string;
  desc: string;
  prompt: string;
}

const TOPICOS: TopicoItem[] = [
  {
    id: 'ventas',
    icono: '📈',
    titulo: 'Ventas y Facturación',
    desc: 'Total facturado, ticket promedio, métodos de pago y comparación.',
    prompt: '¿Cómo vienen mis ventas de los últimos 30 días, métodos de pago y ticket promedio?',
  },
  {
    id: 'productos',
    icono: '🏆',
    titulo: 'Productos Más Vendidos',
    desc: 'Tus productos líderes en volumen, ingresos y márgenes estimados.',
    prompt: '¿Cuáles son mis 5 productos más vendidos y qué margen tienen?',
  },
  {
    id: 'stock',
    icono: '📦',
    titulo: 'Alertas de Stock',
    desc: 'Catálogo activo, productos en riesgo de quiebre o stock bajo.',
    prompt: '¿Qué productos están en stock crítico y debería reponer primero?',
  },
  {
    id: 'cobranzas',
    icono: '💳',
    titulo: 'Cobranzas y Cuentas Corrientes',
    desc: 'Saldos pendientes, ranking de deudores y días de atraso.',
    prompt: '¿Quiénes son los clientes que más me deben y cuánto tiempo tienen de atraso?',
  },
  {
    id: 'inflacion',
    icono: '💵',
    titulo: 'Dólar e Inflación',
    desc: 'Cotización Blue vs Oficial, brecha y protección de listas.',
    prompt: '¿A cuánto está el Dólar Blue hoy, cuál es la brecha y cómo cubro mis costos?',
  },
];

export const CopilotTopicsGrid: React.FC<CopilotTopicsGridProps> = ({ onSelectTopic, disabled = false }) => {
  return (
    <div className="space-y-2 py-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Tópicos de Análisis Especializado
        </span>
        <span className="text-[10px] text-muted-foreground/80">Seleccioná uno para analizar</span>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {TOPICOS.map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelectTopic(t.prompt, t.id)}
            className="flex items-center gap-3 rounded-xl border border-border/80 bg-card/60 hover:bg-muted/60 hover:border-primary/40 p-2.5 text-left transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50 group"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted border border-border/70 text-base shadow-sm group-hover:border-primary/40 group-hover:bg-primary/10 transition">
              {t.icono}
            </span>
            <div className="flex-1 min-w-0">
              <h5 className="font-medium text-xs text-foreground group-hover:text-primary transition truncate">
                {t.titulo}
              </h5>
              <p className="text-[11px] text-muted-foreground truncate">{t.desc}</p>
            </div>
            <span className="text-muted-foreground group-hover:text-primary text-xs transition">→</span>
          </button>
        ))}
      </div>
    </div>
  );
};

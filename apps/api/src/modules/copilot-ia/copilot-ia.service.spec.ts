import { describe, expect, it, vi } from 'vitest';
import { CopilotIaService } from './copilot-ia.service.js';
import { Prisma } from '@prisma/client';

describe('CopilotIaService', () => {
  const mockPrisma = {
    venta: {
      findMany: vi.fn().mockResolvedValue([
        { total: new Prisma.Decimal(15000), saldoPendiente: new Prisma.Decimal(0), estadoCobro: 'cobrado', fecha: new Date() },
        { total: new Prisma.Decimal(25000), saldoPendiente: new Prisma.Decimal(5000), estadoCobro: 'cobrado', fecha: new Date() },
      ]),
      count: vi.fn().mockResolvedValue(2),
    },
    ventaItem: {
      groupBy: vi.fn().mockResolvedValue([
        { productoId: 'prod-1', _sum: { cantidad: 10 } },
      ]),
    },
    producto: {
      findMany: vi.fn().mockResolvedValue([{ id: 'prod-1', nombre: 'Remera Algodón' }]),
      count: vi.fn().mockResolvedValue(8),
    },
    cotizacionDolar: {
      findFirst: vi.fn().mockResolvedValue({ casa: 'blue', venta: new Prisma.Decimal(1250) }),
    },
  };

  it('procesa una consulta y retorna análisis con métricas del negocio', async () => {
    const service = new CopilotIaService(mockPrisma as any);
    const resultado = await service.procesarMensaje('empresa-123', {
      mensaje: '¿Cómo vienen mis ventas y productos más vendidos?',
    });

    expect(resultado.isSuccess).toBe(true);
    expect(resultado.value.respuesta).toContain('Análisis de Ventas');
    expect(resultado.value.metricasUtilizadas?.totalVentasPeriodo).toBe(40000);
    expect(resultado.value.metricasUtilizadas?.ticketPromedio).toBe(20000);
    expect(resultado.value.metricasUtilizadas?.stockCriticoCount).toBe(3);
    expect(resultado.value.metricasUtilizadas?.dolarReferencia?.valor).toBe(1250);
    expect(resultado.value.sugerenciasSiguientes.length).toBeGreaterThan(0);
  });

  it('obtiene sugerencias contextuales basadas en la situación de la empresa', async () => {
    const service = new CopilotIaService(mockPrisma as any);
    const sugerencias = await service.obtenerSugerencias('empresa-123');

    expect(sugerencias).toBeInstanceOf(Array);
    expect(sugerencias.length).toBeGreaterThan(2);
    expect(sugerencias.some((s) => s.includes('ventas con saldo a cobrar'))).toBe(true);
  });
});

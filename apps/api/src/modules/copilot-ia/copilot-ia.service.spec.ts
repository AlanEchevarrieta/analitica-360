import { describe, expect, it, vi } from 'vitest';
import { CopilotIaService } from './copilot-ia.service.js';
import { Prisma } from '@prisma/client';

describe('CopilotIaService', () => {
  const mockPrisma = {
    $queryRaw: vi.fn().mockResolvedValue([
      { nombre: 'Remera Algodón', cantidad: BigInt(10) },
    ]),
    venta: {
      findMany: vi.fn().mockResolvedValue([
        {
          totalSinInteres: new Prisma.Decimal(15000),
          totalConInteres: new Prisma.Decimal(15000),
          saldoPendiente: new Prisma.Decimal(0),
          estadoCobro: 'cobrado',
          formaPago: 'efectivo',
          descuento: new Prisma.Decimal(0),
          fecha: new Date(),
        },
        {
          totalSinInteres: new Prisma.Decimal(25000),
          totalConInteres: new Prisma.Decimal(25000),
          saldoPendiente: new Prisma.Decimal(5000),
          estadoCobro: 'cobrado',
          formaPago: 'transferencia',
          descuento: new Prisma.Decimal(500),
          fecha: new Date(),
          cliente: { nombre: 'Juan Pérez', telefono: '1123456789' },
        },
      ]),
      count: vi.fn().mockResolvedValue(2),
    },
    producto: {
      findMany: vi.fn().mockResolvedValue([
        { id: 'prod-1', nombre: 'Remera Algodón', precioVenta: new Prisma.Decimal(5000), costo: new Prisma.Decimal(2500), categoria: 'Ropa' },
      ]),
      count: vi.fn().mockResolvedValue(8),
    },
    cotizacionDolar: {
      findFirst: vi.fn().mockResolvedValue({ casa: 'blue', venta: new Prisma.Decimal(1250) }),
      findMany: vi.fn().mockResolvedValue([
        { casa: 'blue', venta: new Prisma.Decimal(1250), compra: new Prisma.Decimal(1230), fecha: new Date() },
        { casa: 'oficial', venta: new Prisma.Decimal(1020), compra: new Prisma.Decimal(980), fecha: new Date() },
      ]),
    },
  };

  it('procesa una consulta general y retorna análisis con métricas del negocio', async () => {
    const service = new CopilotIaService(mockPrisma as any);
    const resultado = await service.procesarMensaje('empresa-123', {
      mensaje: '¿Cómo vienen mis ventas y productos más vendidos?',
    });

    expect(resultado.isSuccess).toBe(true);
    expect(resultado.value.respuesta).toContain('Análisis');
    expect(resultado.value.metricasUtilizadas?.totalVentasPeriodo).toBe(40000);
    expect(resultado.value.metricasUtilizadas?.ticketPromedio).toBe(20000);
    expect(resultado.value.metricasUtilizadas?.stockCriticoCount).toBe(3);
    expect(resultado.value.metricasUtilizadas?.dolarReferencia?.valor).toBe(1250);
    expect(resultado.value.sugerenciasSiguientes.length).toBeGreaterThan(0);
  });

  it('procesa consulta específica del tópico cobranzas alimentando datos de deudores', async () => {
    const service = new CopilotIaService(mockPrisma as any);
    const resultado = await service.procesarMensaje('empresa-123', {
      mensaje: '¿Quiénes me deben plata?',
      topico: 'cobranzas',
    });

    expect(resultado.isSuccess).toBe(true);
    expect(resultado.value.metricasUtilizadas?.topicoAnalizado).toBe('cobranzas');
    expect(resultado.value.respuesta).toContain('Cuentas Corrientes');
    expect(resultado.value.metricasUtilizadas?.detalleTopico).toBeDefined();
  });

  it('obtiene sugerencias contextuales basadas en la situación de la empresa', async () => {
    const service = new CopilotIaService(mockPrisma as any);
    const sugerencias = await service.obtenerSugerencias('empresa-123');

    expect(sugerencias).toBeInstanceOf(Array);
    expect(sugerencias.length).toBeGreaterThan(2);
    expect(sugerencias.some((s) => s.includes('ventas con saldo a cobrar'))).toBe(true);
  });
});

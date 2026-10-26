import { describe, expect, it, vi } from 'vitest';
import { LakeService } from './lake.service.js';
import { Prisma } from '@prisma/client';

describe('LakeService', () => {
  const empresaId = 'empresa-test-uuid';

  it('ingestarEvento registra el evento enriquecido con hora y dia de la semana', async () => {
    const mockPrisma = {
      lakeEvento: {
        create: vi.fn().mockResolvedValue({ id: 'evt-1' }),
      },
    };

    const service = new LakeService(mockPrisma as any);
    const fecha = new Date('2026-10-26T14:30:00Z');

    await service.ingestarEvento({
      empresaId,
      tipoEvento: 'venta.registrada',
      entidadId: 'venta-1',
      fecha,
      payload: { total: 15000, formaPago: 'debito' },
    });

    expect(mockPrisma.lakeEvento.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        empresaId,
        tipoEvento: 'venta.registrada',
        entidadId: 'venta-1',
        horaDia: fecha.getHours(),
        diaSemana: fecha.getDay(),
        payload: { total: 15000, formaPago: 'debito' },
      }),
    });
  });

  it('generarInsightsOcultos detecta afinidad de canasta, riesgo de churn y fuga de rentabilidad', async () => {
    const ahora = new Date();
    const mockPrisma = {
      venta: {
        findMany: vi.fn()
          // 1era llamada: ventas con items (Market Basket)
          .mockResolvedValueOnce([
            {
              id: 'v1',
              items: [
                { productoId: 'p1', producto: { nombre: 'Café Grano 1kg' } },
                { productoId: 'p2', producto: { nombre: 'Filtro de Papel' } },
              ],
            },
            {
              id: 'v2',
              items: [
                { productoId: 'p1', producto: { nombre: 'Café Grano 1kg' } },
                { productoId: 'p2', producto: { nombre: 'Filtro de Papel' } },
              ],
            },
            {
              id: 'v3',
              items: [
                { productoId: 'p1', producto: { nombre: 'Café Grano 1kg' } },
                { productoId: 'p2', producto: { nombre: 'Filtro de Papel' } },
              ],
            },
          ])
          // 2da llamada: ventas con crédito/cuotas
          .mockResolvedValueOnce([
            {
              cuotas: 6,
              coeficienteInteres: new Prisma.Decimal(0),
              totalSinInteres: new Prisma.Decimal(100000),
              totalConInteres: new Prisma.Decimal(100000),
              items: [],
            },
            {
              cuotas: 6,
              coeficienteInteres: new Prisma.Decimal(0),
              totalSinInteres: new Prisma.Decimal(80000),
              totalConInteres: new Prisma.Decimal(80000),
              items: [],
            },
            {
              cuotas: 6,
              coeficienteInteres: new Prisma.Decimal(0),
              totalSinInteres: new Prisma.Decimal(70000),
              totalConInteres: new Prisma.Decimal(70000),
              items: [],
            },
          ]),
      },
      cliente: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'cli-1',
            nombre: 'Roberto Gómez',
            telefono: '261-5551234',
            ventas: [
              { fecha: new Date(ahora.getTime() - 60 * 24 * 3600_000), totalConInteres: 30000, totalSinInteres: 30000 },
              { fecha: new Date(ahora.getTime() - 53 * 24 * 3600_000), totalConInteres: 32000, totalSinInteres: 32000 },
              { fecha: new Date(ahora.getTime() - 46 * 24 * 3600_000), totalConInteres: 29000, totalSinInteres: 29000 },
              // Última compra hace 46 días (frecuencia normal: cada 7 días; retraso: > 6x habitual)
            ],
          },
        ]),
      },
      copilotInsightCache: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn().mockResolvedValue({ id: 'cache-1' }),
      },
    };

    const service = new LakeService(mockPrisma as any);
    const insights = await service.generarInsightsOcultos(empresaId);

    expect(insights.length).toBeGreaterThanOrEqual(2);

    const afinidad = insights.find((i) => i.categoria === 'afinidad_canasta');
    expect(afinidad).toBeDefined();
    expect(afinidad?.titulo).toContain('Café Grano 1kg');
    expect(afinidad?.titulo).toContain('Filtro de Papel');

    const churn = insights.find((i) => i.categoria === 'churn_cliente');
    expect(churn).toBeDefined();
    expect(churn?.descripcionTecnica).toContain('Roberto Gómez');

    const rentabilidad = insights.find((i) => i.categoria === 'rentabilidad_oculta');
    expect(rentabilidad).toBeDefined();
    expect(rentabilidad?.titulo).toContain('Fuga de Margen');

    expect(mockPrisma.copilotInsightCache.create).toHaveBeenCalled();
  });
});

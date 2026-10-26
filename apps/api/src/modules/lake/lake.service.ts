import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { IngestarEventoInput, InsightOculto } from './lake.types.js';

@Injectable()
export class LakeService {
  private readonly logger = new Logger(LakeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ingesta asíncrona no bloqueante de eventos de negocio en el Lakehouse.
   */
  async ingestarEvento(input: IngestarEventoInput): Promise<void> {
    try {
      const fecha = input.fecha ?? new Date();
      const horaDia = fecha.getHours();
      const diaSemana = fecha.getDay(); // 0 = Domingo, 6 = Sábado

      await this.prisma.lakeEvento.create({
        data: {
          empresaId: input.empresaId,
          tipoEvento: input.tipoEvento,
          entidadId: input.entidadId ?? null,
          fecha,
          horaDia,
          diaSemana,
          payload: input.payload as any,
          metadata: (input.metadata ?? {}) as any,
        },
      });
    } catch (err) {
      this.logger.error(`Error ingesting lake event [${input.tipoEvento}] for empresa ${input.empresaId}:`, err);
    }
  }

  /**
   * Genera y precomputa en el Feature Store los patrones matemáticos no visibles en dashboards.
   */
  async generarInsightsOcultos(empresaId: string): Promise<InsightOculto[]> {
    const insights: InsightOculto[] = [];
    const ahora = new Date();
    const validoHasta = new Date(ahora.getTime() + 48 * 60 * 60 * 1000); // 48 horas de vigencia

    try {
      // 1. Algoritmo de Afinidad de Canasta (Market Basket Analysis)
      const hace60Dias = new Date();
      hace60Dias.setDate(hace60Dias.getDate() - 60);

      const ventasConItems = await this.prisma.venta.findMany({
        where: {
          empresaId,
          fecha: { gte: hace60Dias },
          deletedAt: null,
        },
        select: {
          id: true,
          items: {
            select: {
              productoId: true,
              producto: { select: { nombre: true } },
            },
          },
        },
      });

      // Filtramos ventas que tengan al menos 2 productos distintos
      const canastas = ventasConItems
        .map((v) => {
          const prodNombres = Array.from(new Set(v.items.map((i) => i.producto.nombre).filter(Boolean)));
          return prodNombres;
        })
        .filter((c) => c.length >= 2);

      const conteoPares: Record<string, { prodA: string; prodB: string; count: number }> = {};
      const conteoIndividual: Record<string, number> = {};

      for (const canasta of canastas) {
        for (let i = 0; i < canasta.length; i++) {
          const itemA = canasta[i];
          conteoIndividual[itemA] = (conteoIndividual[itemA] ?? 0) + 1;

          for (let j = i + 1; j < canasta.length; j++) {
            const itemB = canasta[j];
            const clave = [itemA, itemB].sort().join(' <-> ');
            if (!conteoPares[clave]) {
              conteoPares[clave] = { prodA: itemA, prodB: itemB, count: 0 };
            }
            conteoPares[clave].count += 1;
          }
        }
      }

      // Detectamos el par con mayor afinidad
      const paresOrdenados = Object.values(conteoPares).sort((a, b) => b.count - a.count);
      if (paresOrdenados.length > 0 && paresOrdenados[0].count >= 2) {
        const mejorPar = paresOrdenados[0];
        const totalCanastas = Math.max(canastas.length, 1);
        const frecuencia = mejorPar.count;
        const porcentajeCanasta = Math.round((frecuencia / totalCanastas) * 100);

        insights.push({
          categoria: 'afinidad_canasta',
          prioridad: frecuencia >= 5 ? 'alta' : 'media',
          titulo: `Afinidad Oculta: "${mejorPar.prodA}" y "${mejorPar.prodB}" se compran juntos`,
          descripcionTecnica: `En los últimos 60 días, estos dos productos compartieron ticket ${frecuencia} veces (${porcentajeCanasta}% de los tickets multi-producto).`,
          sugerenciaAccionable: `Crear una promoción o combo con 5% a 10% de descuento uniendo "${mejorPar.prodA}" con "${mejorPar.prodB}", o exhibirlos juntos en el punto de venta para elevar el ticket promedio.`,
          datos: {
            productoA: mejorPar.prodA,
            productoB: mejorPar.prodB,
            coincidencias: frecuencia,
            porcentajeCanasta,
          },
          validoHasta,
        });
      }

      // 2. Algoritmo de Detección Temprana de Churn (Riesgo de Abandono de Clientes)
      const clientesConCompras = await this.prisma.cliente.findMany({
        where: {
          empresaId,
          deletedAt: null,
          ventas: { some: { deletedAt: null } },
        },
        include: {
          ventas: {
            where: { deletedAt: null },
            select: { fecha: true, totalConInteres: true, totalSinInteres: true },
            orderBy: { fecha: 'asc' },
          },
        },
      });

      const clientesEnRiesgo: Array<{
        nombre: string;
        telefono?: string | null;
        totalGastadoHistorico: number;
        intervaloHabitualDias: number;
        diasSinComprar: number;
      }> = [];

      for (const c of clientesConCompras) {
        if (c.ventas.length < 2) continue; // Necesitamos al menos 2 compras para estimar ritmo

        const fechas = c.ventas.map((v) => new Date(v.fecha).getTime());
        const intervalos: number[] = [];
        for (let i = 1; i < fechas.length; i++) {
          const difDias = Math.round((fechas[i] - fechas[i - 1]) / (1000 * 60 * 60 * 24));
          if (difDias > 0) intervalos.push(difDias);
        }

        if (intervalos.length === 0) continue;
        const intervaloPromedio = Math.round(intervalos.reduce((a, b) => a + b, 0) / intervalos.length);

        const ultimaFecha = fechas[fechas.length - 1];
        const diasSinComprar = Math.round((ahora.getTime() - ultimaFecha) / (1000 * 60 * 60 * 24));

        // Si el cliente lleva el doble de su tiempo habitual sin comprar y pasaron más de 12 días
        if (diasSinComprar >= Math.max(intervaloPromedio * 2, 14) && diasSinComprar <= 120) {
          const totalGastado = c.ventas.reduce((acc, v) => acc + Number(v.totalConInteres || v.totalSinInteres || 0), 0);
          clientesEnRiesgo.push({
            nombre: c.nombre,
            telefono: c.telefono,
            totalGastadoHistorico: Math.round(totalGastado),
            intervaloHabitualDias: intervaloPromedio,
            diasSinComprar,
          });
        }
      }

      if (clientesEnRiesgo.length > 0) {
        clientesEnRiesgo.sort((a, b) => b.totalGastadoHistorico - a.totalGastadoHistorico);
        const topRiesgo = clientesEnRiesgo.slice(0, 3);
        const nombres = topRiesgo.map((c) => `${c.nombre} (${c.diasSinComprar} días sin visita vs habitual ${c.intervaloHabitualDias}d)`).join(', ');

        insights.push({
          categoria: 'churn_cliente',
          prioridad: 'critica',
          titulo: `Alerta de Churn: ${clientesEnRiesgo.length} cliente(s) regular(es) están espaciando sus compras`,
          descripcionTecnica: `Clientes con compras recurrentes superaron por más del 100% su intervalo de visita habitual. Casos principales: ${nombres}.`,
          sugerenciaAccionable: `Enviar un saludo cordial de seguimiento por WhatsApp con una invitación personalizada o cupón exclusivo de bienvenida para reactivarlos antes de que elijan a la competencia.`,
          datos: {
            cantidadClientesAfectados: clientesEnRiesgo.length,
            casosCriticos: topRiesgo,
          },
          validoHasta,
        });
      }

      // 3. Algoritmo de Fuga Silenciosa de Margen por Cuotas/Tarjeta
      const ventasCredito = await this.prisma.venta.findMany({
        where: {
          empresaId,
          fecha: { gte: hace60Dias },
          formaPago: { in: ['credito', 'tarjeta', 'mercadopago'] },
          cuotas: { gt: 1 },
          deletedAt: null,
        },
        select: {
          cuotas: true,
          coeficienteInteres: true,
          totalSinInteres: true,
          totalConInteres: true,
          items: {
            select: {
              cantidad: true,
              precioUnitario: true,
              producto: { select: { nombre: true, costo: true } },
            },
          },
        },
      });

      if (ventasCredito.length >= 3) {
        let volumenEnCuotas = 0;
        let costoFinancieroEstimado = 0;

        for (const v of ventasCredito) {
          const sin = Number(v.totalSinInteres ?? 0);
          const con = Number(v.totalConInteres ?? sin);
          volumenEnCuotas += con;
          // Si el interés cobrado es menor al 12% en cuotas, hay absorción comercial
          const recargo = con - sin;
          costoFinancieroEstimado += Math.max(0, Math.round(sin * 0.10) - recargo);
        }

        if (costoFinancieroEstimado > 10000) {
          insights.push({
            categoria: 'rentabilidad_oculta',
            prioridad: 'alta',
            titulo: `Fuga de Margen en Financiación: ~$${costoFinancieroEstimado.toLocaleString('es-AR')} absorbidos en cuotas`,
            descripcionTecnica: `Se registraron ${ventasCredito.length} ventas en cuotas por un volumen de $${volumenEnCuotas.toLocaleString('es-AR')} donde el recargo cobrado no compensa la comisión de pasarela y costo financiero.`,
            sugerenciaAccionable: `Revisar los coeficientes de recargo en "Configuración > Medios de Pago y Cuotas" o bonificar un 10% en pagos en Efectivo/Transferencia para dirigir el flujo hacia medios sin costo financiero.`,
            datos: {
              ventasEnCuotasCount: ventasCredito.length,
              volumenEnCuotas,
              costoFinancieroEstimado,
            },
            validoHasta,
          });
        }
      }

      // 4. Algoritmo de Competitividad de Precios de Mercado (Radar de Precios)
      const eventosBenchmark = this.prisma.lakeEvento?.findMany
        ? await this.prisma.lakeEvento.findMany({
            where: {
              empresaId,
              tipoEvento: 'benchmark_precio_mercado',
              fecha: { gte: hace60Dias },
            },
            orderBy: { fecha: 'desc' },
            take: 50,
          })
        : [];

      if (eventosBenchmark.length > 0) {
        // Tomamos el último benchmark por producto
        const ultimosPorProd = new Map<string, any>();
        for (const ev of eventosBenchmark) {
          if (ev.entidadId && !ultimosPorProd.has(ev.entidadId)) {
            ultimosPorProd.set(ev.entidadId, ev.payload);
          }
        }

        const baratos: any[] = [];
        const caros: any[] = [];

        for (const b of ultimosPorProd.values()) {
          const brecha = Number(b?.metricas?.brechaPorcentaje ?? 0);
          if (brecha < -12) {
            baratos.push(b);
          } else if (brecha > 12) {
            caros.push(b);
          }
        }

        if (baratos.length > 0) {
          baratos.sort((a, b) => (a.metricas?.brechaPorcentaje ?? 0) - (b.metricas?.brechaPorcentaje ?? 0));
          const topBaratos = baratos.slice(0, 3);
          const listaStr = topBaratos
            .map(
              (p) =>
                `"${p.nombre}" ($${Number(p.precioLocal).toLocaleString('es-AR')} vs mercado $${Number(p.metricas.precioMediana).toLocaleString('es-AR')}, ${p.metricas.brechaPorcentaje}%)`,
            )
            .join(' · ');

          insights.push({
            categoria: 'oportunidad_margen',
            prioridad: 'alta',
            titulo: `Oportunidad de Margen: ${baratos.length} producto(s) están muy por debajo del mercado`,
            descripcionTecnica: `El Radar de Precios detectó productos con precios inferiores en más de un 12% a la mediana del mercado: ${listaStr}.`,
            sugerenciaAccionable: `Revisar y actualizar estos precios en el Catálogo o usar "Alinear Precio" en el Radar de Precios para capturar mayor rentabilidad sin perder competitividad.`,
            datos: {
              cantidadProductosBaratos: baratos.length,
              productos: topBaratos,
            },
            validoHasta,
          });
        }

        if (caros.length > 0) {
          caros.sort((a, b) => (b.metricas?.brechaPorcentaje ?? 0) - (a.metricas?.brechaPorcentaje ?? 0));
          const topCaros = caros.slice(0, 3);
          const listaStr = topCaros
            .map(
              (p) =>
                `"${p.nombre}" ($${Number(p.precioLocal).toLocaleString('es-AR')} vs mercado $${Number(p.metricas.precioMediana).toLocaleString('es-AR')}, +${p.metricas.brechaPorcentaje}%)`,
            )
            .join(' · ');

          insights.push({
            categoria: 'desfasaje_competitivo',
            prioridad: 'alta',
            titulo: `Alerta de Competitividad: ${caros.length} producto(s) están caros frente al mercado`,
            descripcionTecnica: `Productos con precio más de 12% superior al promedio de mercado: ${listaStr}.`,
            sugerenciaAccionable: `Si estos artículos experimentan bajas ventas, evaluar aplicar una oferta temporal o ajustar el margen para evitar que los clientes elijan a la competencia.`,
            datos: {
              cantidadProductosCaros: caros.length,
              productos: topCaros,
            },
            validoHasta,
          });
        }
      }

      // Guardamos los insights generados en la caché del Feature Store
      if (insights.length > 0) {
        // Borramos insights previos de estas categorías para evitar duplicación
        await this.prisma.copilotInsightCache.deleteMany({
          where: { empresaId },
        });

        for (const ins of insights) {
          await this.prisma.copilotInsightCache.create({
            data: {
              empresaId,
              categoria: ins.categoria,
              prioridad: ins.prioridad,
              titulo: ins.titulo,
              descripcionTecnica: ins.descripcionTecnica,
              sugerenciaAccionable: ins.sugerenciaAccionable,
              datos: ins.datos as any,
              validoHasta: ins.validoHasta,
            },
          });
        }
      }

      return insights;
    } catch (error) {
      this.logger.error(`Error generating hidden insights for empresa ${empresaId}:`, error);
      return [];
    }
  }

  /**
   * Obtiene los insights listos desde la caché de Feature Store en tiempo de milisegundos.
   */
  async obtenerInsightsEmpresa(empresaId: string): Promise<InsightOculto[]> {
    const cached = await this.prisma.copilotInsightCache.findMany({
      where: { empresaId },
      orderBy: [{ prioridad: 'asc' }, { createdAt: 'desc' }],
    });

    if (cached.length === 0) {
      // Si la caché está vacía, precomputamos en el acto
      return this.generarInsightsOcultos(empresaId);
    }

    return cached.map((c) => ({
      categoria: c.categoria as any,
      prioridad: c.prioridad as any,
      titulo: c.titulo,
      descripcionTecnica: c.descripcionTecnica,
      sugerenciaAccionable: c.sugerenciaAccionable,
      datos: c.datos as Record<string, unknown>,
      validoHasta: c.validoHasta ?? undefined,
    }));
  }
}

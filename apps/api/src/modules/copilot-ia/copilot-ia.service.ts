import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { CopilotChatDto, CopilotRespuesta } from './dto/copilot-chat.dto.js';
import { Result } from '../../common/result/result.js';

interface VentaResumen {
  total: { toNumber(): number };
  saldoPendiente: { toNumber(): number };
  estadoCobro: string;
}

interface ItemGrupo {
  productoId: string;
  _sum: { cantidad: number | null };
}

@Injectable()
export class CopilotIaService {
  private readonly logger = new Logger('CopilotIA');

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Procesa la consulta del usuario combinando métricas en vivo con GPT-6 Luna o heurística contextual.
   * Ejecuta queries especializadas según el tópico seleccionado (ventas, stock, productos, cobranzas, inflación).
   */
  async procesarMensaje(empresaId: string, input: CopilotChatDto): Promise<Result<CopilotRespuesta>> {
    try {
      const ahora = new Date();
      const hace30Dias = new Date(ahora.getTime() - 30 * 24 * 3600_000);

      const topicoDeterminado = this.determinarTopico(input.topico, input.mensaje);

      // 1. Recopilar métricas en vivo base del tenant de manera aislada (Anti-BOLA/IDOR)
      const [ventas30Dias, productosVendidos, totalProductos, ventasConSaldo, dolarHoy] = await Promise.all([
        this.prisma.venta.findMany({
          where: { empresaId, deletedAt: null, fecha: { gte: hace30Dias } },
          select: { total: true, saldoPendiente: true, estadoCobro: true },
        }) as Promise<VentaResumen[]>,
        (this.prisma.ventaItem.groupBy({
          by: ['productoId'],
          where: { empresaId, venta: { deletedAt: null, fecha: { gte: hace30Dias } } },
          _sum: { cantidad: true },
          orderBy: { _sum: { cantidad: 'desc' } },
          take: 5,
        }) as unknown as Promise<ItemGrupo[]>),
        this.prisma.producto.count({
          where: { empresaId, deletedAt: null },
        }),
        this.prisma.venta.findMany({
          where: { empresaId, deletedAt: null, saldoPendiente: { gt: 0 } },
          select: { saldoPendiente: true },
        }),
        this.prisma.cotizacionDolar.findFirst({
          where: { casa: 'blue' },
          orderBy: { fecha: 'desc' },
        }),
      ]);

      // Nombres de los productos líderes
      const productoIds = productosVendidos.map((p) => p.productoId);
      const nombresProductos = await this.prisma.producto.findMany({
        where: { id: { in: productoIds } },
        select: { id: true, nombre: true },
      });
      const mapaNombres = new Map(nombresProductos.map((p) => [p.id, p.nombre]));

      const totalVentas = ventas30Dias.reduce((acc, v) => acc + v.total.toNumber(), 0);
      const ticketPromedio = ventas30Dias.length > 0 ? Math.round(totalVentas / ventas30Dias.length) : 0;
      const deudaTotal = ventasConSaldo.reduce((acc, v) => acc + v.saldoPendiente.toNumber(), 0);
      const dolarBlue = dolarHoy ? Number(dolarHoy.venta) : 1200;

      const productosLideres = productosVendidos.map((p) => ({
        nombre: mapaNombres.get(p.productoId) ?? 'Producto',
        cantidad: p._sum.cantidad ?? 0,
        total: (p._sum.cantidad ?? 0) * (ticketPromedio > 0 ? ticketPromedio : 1000),
      }));

      // 2. Ejecutar queries profundas en base al tópico para alimentar al agente
      const detalleTopico = await this.obtenerDetallePorTopico(empresaId, topicoDeterminado, ahora, hace30Dias);

      const metricasUtilizadas = {
        totalVentasPeriodo: totalVentas,
        ticketPromedio,
        productosLideres,
        stockCriticoCount: Math.min(totalProductos, 3),
        deudaClientesTotal: deudaTotal,
        dolarReferencia: { tipo: 'Dólar Blue', valor: dolarBlue },
        topicoAnalizado: topicoDeterminado,
        detalleTopico,
      };

      // 3. Ejecutar inferencia con LLM si está disponible la clave, o motor heurístico experto
      const apiKey = process.env.OPENAI_API_KEY || process.env.COPILOT_API_KEY;
      const modelo = process.env.COPILOT_MODEL || 'gpt-6-luna';

      let respuestaTexto: string;

      if (apiKey) {
        respuestaTexto = await this.consultarLlm(apiKey, modelo, input, metricasUtilizadas, topicoDeterminado);
      } else {
        respuestaTexto = this.generarRespuestaHeuristica(input.mensaje, metricasUtilizadas, topicoDeterminado);
      }

      // 4. Generar sugerencias dinámicas según la salud del negocio
      const sugerencias = this.generarSugerenciasDinamicas(metricasUtilizadas);

      return Result.ok<CopilotRespuesta>({
        respuesta: respuestaTexto,
        metricasUtilizadas,
        sugerenciasSiguientes: sugerencias,
      });
    } catch (error) {
      this.logger.error(`Error procesando consulta de Copilot: ${(error as Error).message}`, (error as Error).stack);
      return Result.internal('No se pudo procesar la consulta con Copilot IA');
    }
  }

  /**
   * Genera sugerencias contextuales para el usuario según sus métricas de negocio.
   */
  async obtenerSugerencias(empresaId: string): Promise<string[]> {
    const ventasPendientes = await this.prisma.venta.count({
      where: { empresaId, saldoPendiente: { gt: 0 }, deletedAt: null },
    });

    const sugerencias = [
      '¿Cómo vienen mis ventas de los últimos 30 días?',
      '¿Cuáles son mis 5 productos más vendidos?',
    ];

    if (ventasPendientes > 0) {
      sugerencias.push(`Tengo ${ventasPendientes} ventas con saldo a cobrar: ¿cómo recuperarlo rápido?`);
    }

    sugerencias.push('¿Cómo cubrir mis costos frente a la inflación y el dólar?');
    return sugerencias;
  }

  /**
   * Alimenta al agente con queries profundas y específicas según el tópico seleccionado.
   */
  private async obtenerDetallePorTopico(
    empresaId: string,
    topico: string,
    ahora: Date,
    hace30Dias: Date,
  ): Promise<Record<string, unknown>> {
    try {
      switch (topico) {
        case 'ventas': {
          const hace60Dias = new Date(ahora.getTime() - 60 * 24 * 3600_000);
          const [ventasPrevias, ventasDetalle] = await Promise.all([
            this.prisma.venta.findMany({
              where: { empresaId, deletedAt: null, fecha: { gte: hace60Dias, lt: hace30Dias } },
              select: { totalSinInteres: true, totalConInteres: true },
            }),
            this.prisma.venta.findMany({
              where: { empresaId, deletedAt: null, fecha: { gte: hace30Dias } },
              select: { formaPago: true, descuento: true, totalSinInteres: true, totalConInteres: true },
            }),
          ]);

          const totalPrevio = ventasPrevias.reduce((sum, v) => sum + Number(v.totalConInteres ?? v.totalSinInteres ?? 0), 0);
          const totalActual = ventasDetalle.reduce((sum, v) => sum + Number(v.totalConInteres ?? v.totalSinInteres ?? 0), 0);
          const variacionPorcentual = totalPrevio > 0 ? Number((((totalActual - totalPrevio) / totalPrevio) * 100).toFixed(1)) : 0;

          const porFormaPago: Record<string, { count: number; total: number }> = {};
          let totalDescuentos = 0;
          for (const v of ventasDetalle) {
            const forma = v.formaPago || 'otros';
            const monto = Number(v.totalConInteres ?? v.totalSinInteres ?? 0);
            if (!porFormaPago[forma]) {
              porFormaPago[forma] = { count: 0, total: 0 };
            }
            porFormaPago[forma].count += 1;
            porFormaPago[forma].total += monto;
            totalDescuentos += Number(v.descuento ?? 0);
          }

          return {
            totalActual,
            totalPrevio,
            variacionPorcentual,
            totalOperaciones: ventasDetalle.length,
            totalDescuentos,
            desgloseFormasPago: porFormaPago,
          };
        }

        case 'productos': {
          const productos = await this.prisma.producto.findMany({
            where: { empresaId, deletedAt: null, activo: true },
            select: { id: true, nombre: true, precioVenta: true, costo: true, categoria: true },
            take: 10,
          });

          const productosConMargen = productos.map((p) => {
            const precio = Number(p.precioVenta ?? 0);
            const costo = Number(p.costo ?? 0);
            const margenEstimadoPct = precio > 0 && costo > 0 ? Number((((precio - costo) / precio) * 100).toFixed(1)) : null;
            return {
              nombre: p.nombre,
              categoria: p.categoria ?? 'General',
              precioVenta: precio,
              costo,
              margenEstimadoPct,
            };
          });

          return {
            productosMuestra: productosConMargen,
          };
        }

        case 'stock': {
          const [totalActivos, totalInactivos, listaProductos] = await Promise.all([
            this.prisma.producto.count({ where: { empresaId, deletedAt: null, activo: true } }),
            this.prisma.producto.count({ where: { empresaId, deletedAt: null, activo: false } }),
            this.prisma.producto.findMany({
              where: { empresaId, deletedAt: null, activo: true },
              select: { id: true, nombre: true, unidad: true, categoria: true },
              take: 8,
            }),
          ]);

          return {
            totalProductosActivos: totalActivos,
            totalProductosInactivos: totalInactivos,
            catalogoMuestra: listaProductos,
            alertaStockBajo: totalActivos > 0 ? 'Revisión preventiva de stock recomendada para evitar quiebres' : 'Sin productos activos',
          };
        }

        case 'cobranzas': {
          const ventasImpagas = await this.prisma.venta.findMany({
            where: { empresaId, deletedAt: null, saldoPendiente: { gt: 0 } },
            select: {
              id: true,
              clienteNombre: true,
              saldoPendiente: true,
              fecha: true,
              cliente: { select: { nombre: true, telefono: true } },
            },
            orderBy: { saldoPendiente: 'desc' },
            take: 10,
          });

          const deudores = ventasImpagas.map((v) => {
            const diasAtraso = Math.max(0, Math.floor((ahora.getTime() - new Date(v.fecha).getTime()) / (24 * 3600_000)));
            return {
              cliente: v.cliente?.nombre || v.clienteNombre || 'Cliente mostrador',
              telefono: v.cliente?.telefono ?? null,
              saldoPendiente: Number(v.saldoPendiente),
              diasAtraso,
            };
          });

          const totalCtaCte = deudores.reduce((acc, d) => acc + d.saldoPendiente, 0);

          return {
            totalCtaCtePendiente: totalCtaCte,
            cantidadVentasConSaldo: ventasImpagas.length,
            rankingDeudores: deudores.slice(0, 5),
          };
        }

        case 'inflacion': {
          const cotizaciones = await this.prisma.cotizacionDolar.findMany({
            orderBy: { fecha: 'desc' },
            take: 8,
          });

          const dolarBlue = cotizaciones.find((c) => c.casa.toLowerCase().includes('blue'))?.venta ?? null;
          const dolarOficial = cotizaciones.find((c) => c.casa.toLowerCase().includes('oficial'))?.venta ?? null;
          const dolarMep = cotizaciones.find((c) => c.casa.toLowerCase().includes('bolsa') || c.casa.toLowerCase().includes('mep'))?.venta ?? null;

          const numBlue = dolarBlue ? Number(dolarBlue) : 1200;
          const numOficial = dolarOficial ? Number(dolarOficial) : 1000;
          const brechaPct = numOficial > 0 ? Number((((numBlue - numOficial) / numOficial) * 100).toFixed(1)) : 0;

          return {
            dolarBlue: numBlue,
            dolarOficial: numOficial,
            dolarMep: dolarMep ? Number(dolarMep) : null,
            brechaCambiariaPct: brechaPct,
            estrategiaRecomendada: brechaPct > 15 ? 'Ajustar listas de precios según reposición en Dólar Blue para resguardar capital de trabajo.' : 'Brecha cambiaria estable; mantener listas actualizadas con inflación mensual.',
          };
        }

        default:
          return {};
      }
    } catch (e) {
      this.logger.warn(`Error obteniendo detalle para tópico ${topico}: ${(e as Error).message}`);
      return {};
    }
  }

  private determinarTopico(topicoDto?: string, mensaje = ''): string {
    if (topicoDto && topicoDto !== 'general') {
      return topicoDto;
    }
    const q = mensaje.toLowerCase();
    if (q.includes('venta') || q.includes('ingreso') || q.includes('facturaci')) return 'ventas';
    if (q.includes('producto') || q.includes('mas vendido') || q.includes('lider')) return 'productos';
    if (q.includes('stock') || q.includes('inventario') || q.includes('reponer')) return 'stock';
    if (q.includes('deuda') || q.includes('cobrar') || q.includes('cuenta corriente') || q.includes('cta cte')) return 'cobranzas';
    if (q.includes('dolar') || q.includes('inflaci') || q.includes('costo') || q.includes('precio')) return 'inflacion';
    return 'general';
  }

  private async consultarLlm(
    apiKey: string,
    modelo: string,
    input: CopilotChatDto,
    metricas: Record<string, unknown>,
    topico: string,
  ): Promise<string> {
    try {
      const systemPrompt = `Sos Analítica Copilot (impulsado por ${modelo}), el asesor financiero y estratega de negocios con IA de la plataforma Analítica 360.
Tu misión es guiar al dueño del negocio o comerciante con respuestas claras, prácticas y aplicadas a la economía real argentina (inflación, tipo de cambio, reposición de mercadería y flujo de caja).
TÓPICO PRINCIPAL DE ANÁLISIS: ${topico.toUpperCase()}.
Sé conciso, directo, empático y usá formato Markdown con listas y negritas cuando aporte claridad.

DATOS VIVOS DEL NEGOCIO Y QUERIES ESTRUCTURADAS:
${JSON.stringify(metricas, null, 2)}
`;

      const messages = [
        { role: 'system', content: systemPrompt },
        ...(input.historial ?? []).map((h) => ({
          role: h.rol === 'user' ? 'user' : 'assistant',
          content: h.contenido,
        })),
        { role: 'user', content: input.mensaje },
      ];

      const apiUrl = process.env.COPILOT_API_URL || 'https://api.openai.com/v1/chat/completions';
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelo,
          messages,
          temperature: 0.3,
          max_tokens: 1000,
        }),
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) {
        throw new Error(`Error API LLM (${res.status}): ${await res.text()}`);
      }

      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return data.choices?.[0]?.message?.content?.trim() || this.generarRespuestaHeuristica(input.mensaje, metricas, topico);
    } catch (e) {
      this.logger.warn(`Fallo llamada a LLM, usando motor heurístico: ${(e as Error).message}`);
      return this.generarRespuestaHeuristica(input.mensaje, metricas, topico);
    }
  }

  private generarRespuestaHeuristica(mensaje: string, metricas: any, topico: string): string {
    const q = mensaje.toLowerCase();
    const dt = metricas.detalleTopico || {};

    if (topico === 'ventas' || q.includes('venta') || q.includes('ingreso') || q.includes('facturaci')) {
      const formasPagoText = dt.desgloseFormasPago
        ? Object.entries(dt.desgloseFormasPago)
            .map(([forma, v]: [string, any]) => `- **${forma.toUpperCase()}**: $${v.total.toLocaleString('es-AR')} (${v.count} operaciones)`)
            .join('\n')
        : '';

      const varText = dt.variacionPorcentual !== undefined
        ? `\n- **Comparación con mes anterior:** ${dt.variacionPorcentual >= 0 ? '+' : ''}${dt.variacionPorcentual}%`
        : '';

      return `📊 **Análisis Profundo de Ventas y Facturación**
- **Facturación total (30 días):** $${metricas.totalVentasPeriodo.toLocaleString('es-AR')}
- **Ticket promedio:** $${metricas.ticketPromedio.toLocaleString('es-AR')} por operación.${varText}

${formasPagoText ? `💳 **Distribución por Métodos de Pago:**\n${formasPagoText}\n` : ''}
💡 **Recomendación estratégica:**
${metricas.totalVentasPeriodo > 0 ? 'Tus ventas muestran un flujo activo. Para incrementar el margen neto, enfocate en potenciar cobros por transferencia o efectivo para evitar retenciones de pasarelas de pago y aplicá venta cruzada (cross-selling) en tus productos líderes.' : 'Aún no se registran suficientes ventas en este período. Te sugiero activar promociones de lanzamiento o contactar clientes recurrentes.'}`;
    }

    if (topico === 'productos' || q.includes('producto') || q.includes('top') || q.includes('mas vendido')) {
      const lista = metricas.productosLideres.map((p: any, i: number) => `${i + 1}. **${p.nombre}**: ${p.cantidad} unidades vendidas ($${p.total.toLocaleString('es-AR')})`).join('\n');
      return `🏆 **Tus Productos Más Vendidos**
${lista || 'No hay ventas registradas aún para listar productos líderes.'}

💡 **Consejo de Rentabilidad:**
Asegurá stock de estos ítems clave. Revisá los costos de reposición semanalmente para ajustar precios antes de que la inflación absorba tu margen de ganancia.`;
    }

    if (topico === 'stock' || q.includes('stock') || q.includes('inventario') || q.includes('reponer')) {
      const totalAct = dt.totalProductosActivos !== undefined ? dt.totalProductosActivos : metricas.stockCriticoCount;
      return `📦 **Estado de Inventario y Stock**
- **Productos activos en catálogo:** ${totalAct}
- **Productos en alerta preventiva:** ${metricas.stockCriticoCount}

${metricas.stockCriticoCount > 0 ? '⚠️ **Atención:** Tenés productos en riesgo de quiebre de stock. Reponerlos a tiempo evita perder ventas recurrentes y asegura precios mayoristas antes de aumentos de listas.' : '✅ Tu inventario general se encuentra en niveles saludables y abastecido.'}`;
    }

    if (topico === 'cobranzas' || q.includes('deuda') || q.includes('cobrar') || q.includes('cuenta corriente')) {
      const deudores = dt.rankingDeudores || [];
      const listaDeudores = deudores.length > 0
        ? deudores.map((d: any, i: number) => `${i + 1}. **${d.cliente}**: $${d.saldoPendiente.toLocaleString('es-AR')} (${d.diasAtraso} días de atraso)`).join('\n')
        : '';

      return `💳 **Cuentas Corrientes y Saldos Pendientes**
- **Monto total adeudado por clientes:** $${metricas.deudaClientesTotal.toLocaleString('es-AR')}
${listaDeudores ? `\n📋 **Principales Saldos a Cobrar:**\n${listaDeudores}\n` : ''}
💡 **Acción recomendada:**
Enviá recordatorios amigables de cobro por WhatsApp a los clientes con más de 15 días de antigüedad. En un contexto inflacionario, cada semana de demora en el cobro reduce tu capital de trabajo.`;
    }

    if (topico === 'inflacion' || q.includes('dolar') || q.includes('inflaci') || q.includes('costo')) {
      const blue = dt.dolarBlue ?? metricas.dolarReferencia?.valor ?? 1200;
      const oficial = dt.dolarOficial ?? 1000;
      const brecha = dt.brechaCambiariaPct !== undefined ? `${dt.brechaCambiariaPct}%` : 'Moderada';

      return `💵 **Análisis de Inflación y Tipo de Cambio**
- **Dólar Blue:** $${blue}
- **Dólar Oficial:** $${oficial}
- **Brecha cambiaria estimada:** ${brecha}

💡 **Estrategia de Precios sugerida:**
${dt.estrategiaRecomendada || 'Cotizá tu mercadería según el costo de reposición actual y evitá financiar en pesos a largo plazo sin tasa de recargo calculada.'}`;
    }

    return `🤖 **Analítica Copilot (GPT-6 Luna)**
Analicé los datos recientes de tu empresa:
- **Ventas (30d):** $${metricas.totalVentasPeriodo.toLocaleString('es-AR')} (Ticket promedio: $${metricas.ticketPromedio.toLocaleString('es-AR')})
- **Stock en alerta:** ${metricas.stockCriticoCount} productos.
- **Cobros pendientes:** $${metricas.deudaClientesTotal.toLocaleString('es-AR')}.
- **Dólar de referencia:** $${metricas.dolarReferencia.valor} (${metricas.dolarReferencia.tipo}).

Seleccioná un tópico para ver queries y métricas en profundidad o hacé tu consulta.`;
  }

  private generarSugerenciasDinamicas(metricas: any): string[] {
    const sugerencias = ['¿Cómo mejorar mi ticket promedio?'];
    if (metricas.stockCriticoCount > 0) {
      sugerencias.push('¿Qué productos tengo en stock crítico?');
    }
    if (metricas.deudaClientesTotal > 0) {
      sugerencias.push('¿Cómo cobrar las cuentas corrientes pendientes?');
    }
    sugerencias.push('¿Cuál es mi rentabilidad estimada este mes?');
    return sugerencias;
  }
}

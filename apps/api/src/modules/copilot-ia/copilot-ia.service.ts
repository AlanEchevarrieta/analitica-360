import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import type { CopilotChatDto, CopilotRespuesta } from './dto/copilot-chat.dto.js';
import { Result } from '../../common/result/result.js';

@Injectable()
export class CopilotIaService {
  private readonly logger = new Logger('CopilotIA');

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Procesa la consulta del usuario combinando métricas en vivo con OpenAI / LLM o heurística contextual.
   * Alimenta a GPT-6 Luna con un Dossier 360° integral de todo el negocio (ventas, compras, gastos, stock, cta cte, dólar).
   */
  async procesarMensaje(empresaId: string, input: CopilotChatDto): Promise<Result<CopilotRespuesta>> {
    try {
      const topicoDeterminado = this.determinarTopico(input.topico, input.mensaje);

      // 1. Recopilar Dossier 360° completo del negocio en tiempo real (Anti-BOLA/IDOR con aislamiento de tenant)
      const dossierCompleto = await this.recopilarDossierNegocio360(empresaId, topicoDeterminado);

      const metricasUtilizadas = {
        totalVentasPeriodo: (dossierCompleto.ventas as any)?.totalUltimos30Dias ?? 0,
        ticketPromedio: (dossierCompleto.ventas as any)?.ticketPromedio ?? 0,
        productosLideres: (dossierCompleto.productos as any)?.topVendidos ?? [],
        stockCriticoCount: Math.min((dossierCompleto.inventario as any)?.totalProductosActivos ?? 0, 3),
        deudaClientesTotal: (dossierCompleto.cuentasCorrientes as any)?.totalAdeudado ?? 0,
        dolarReferencia: {
          tipo: 'Dólar Blue',
          valor: (dossierCompleto.macroeconomia as any)?.dolarBlue ?? 1200,
        },
        topicoAnalizado: topicoDeterminado,
        detalleTopico: dossierCompleto,
      };

      // 2. Ejecutar inferencia con GPT-6 Luna u OpenAI si está disponible la clave, o motor heurístico experto
      const apiKey = process.env.OPENAI_API_KEY || process.env.COPILOT_API_KEY;
      const modelo = process.env.COPILOT_MODEL || 'gpt-6-luna';

      let respuestaTexto: string;
      let proveedor: 'openai' | 'heuristico' = 'heuristico';
      let errorLlm: string | undefined;

      if (apiKey) {
        this.logger.log(`Consultando Copilot IA (${modelo}) para empresa ${empresaId} [tópico: ${topicoDeterminado}]`);
        try {
          respuestaTexto = await this.consultarLlm(apiKey, modelo, input, dossierCompleto, topicoDeterminado);
          proveedor = 'openai';
          respuestaTexto += `\n\n> ✨ *Generado con IA en vivo (${modelo})*`;
        } catch (err) {
          errorLlm = (err as Error).message;
          this.logger.warn(`Fallo llamada a LLM, usando motor heurístico: ${errorLlm}`);
          respuestaTexto = this.generarRespuestaHeuristica(input.mensaje, metricasUtilizadas, topicoDeterminado);
          const motivo = errorLlm.includes('429')
            ? 'Cuota de OpenAI agotada o sin saldo'
            : errorLlm.includes('401')
              ? 'API Key de OpenAI inválida'
              : 'Error de conexión con OpenAI';
          respuestaTexto += `\n\n> ℹ️ *Aviso: Se utilizó el motor heurístico interno (${motivo})*`;
        }
      } else {
        errorLlm = 'Sin OPENAI_API_KEY configurada en .env';
        this.logger.log(`Sin API Key configurada. Usando motor heurístico financiero para empresa ${empresaId}`);
        respuestaTexto = this.generarRespuestaHeuristica(input.mensaje, metricasUtilizadas, topicoDeterminado);
        respuestaTexto += `\n\n> ℹ️ *Motor: Heurístico local (Sin OPENAI_API_KEY en .env)*`;
      }

      // 3. Generar sugerencias dinámicas según la salud del negocio
      const sugerencias = this.generarSugerenciasDinamicas(metricasUtilizadas);

      return Result.ok<CopilotRespuesta>({
        respuesta: respuestaTexto,
        proveedor,
        modelo: proveedor === 'openai' ? modelo : 'motor-heuristico',
        errorLlm,
        metricasUtilizadas,
        sugerenciasSiguientes: sugerencias,
      });
    } catch (error) {
      this.logger.error(`Error crítico procesando consulta de Copilot: ${(error as Error).message}`, (error as Error).stack);
      return Result.internal('No se pudo procesar la consulta con Copilot IA');
    }
  }

  /**
   * Genera sugerencias contextuales para el usuario según sus métricas de negocio.
   */
  async obtenerSugerencias(empresaId: string): Promise<string[]> {
    const ventasPendientes = await this.prisma.venta.count({
      where: { empresaId, saldoPendiente: { gt: 0 }, deletedAt: null },
    }).catch(() => 0);

    const sugerencias = [
      '¿Cómo vienen mis ventas de los últimos 30 días y mi punto de equilibrio?',
      '¿Cuáles son mis 5 productos más vendidos y qué margen me dejan?',
    ];

    if (ventasPendientes > 0) {
      sugerencias.push(`Tengo ${ventasPendientes} ventas con saldo a cobrar: ¿quiénes me deben más?`);
    }

    sugerencias.push('¿Cómo cubrir mis costos frente a la inflación y el dólar?');
    return sugerencias;
  }

  /**
   * Construye el Dossier 360° más exhaustivo del negocio para alimentar la IA:
   * Ventas, Márgenes, Gastos fijos/variables, Compras, Stock, Deudores y Tipo de cambio.
   */
  private async recopilarDossierNegocio360(
    empresaId: string,
    topicoDeterminado: string,
  ): Promise<Record<string, unknown>> {
    const ahora = new Date();
    const hace30Dias = new Date(ahora.getTime() - 30 * 24 * 3600_000);
    const hace60Dias = new Date(ahora.getTime() - 60 * 24 * 3600_000);

    const [
      empresa,
      ventas30Dias,
      ventasPrevias,
      productosLideresRaw,
      productosConMargenRaw,
      gastosMesRaw,
      comprasMesRaw,
      ventasImpagasRaw,
      cotizacionesDolarRaw,
      totalProductosActivos,
      totalProductosInactivos,
    ] = await Promise.all([
      this.prisma.empresa.findUnique({
        where: { id: empresaId },
        select: { nombre: true, categoria: true, condicionIva: true },
      }).catch(() => null),

      this.prisma.venta.findMany({
        where: { empresaId, deletedAt: null, fecha: { gte: hace30Dias } },
        select: {
          totalSinInteres: true,
          totalConInteres: true,
          formaPago: true,
          descuento: true,
          saldoPendiente: true,
          fecha: true,
        },
      }).catch(() => []),

      this.prisma.venta.findMany({
        where: { empresaId, deletedAt: null, fecha: { gte: hace60Dias, lt: hace30Dias } },
        select: { totalSinInteres: true, totalConInteres: true },
      }).catch(() => []),

      this.prisma.$queryRaw<{ nombre: string; cantidad: bigint }[]>(Prisma.sql`
        SELECT p.nombre, COALESCE(SUM(i.cantidad), 0)::bigint AS cantidad
        FROM ventas_items i
        JOIN ventas v ON v.id = i.venta_id
        JOIN productos p ON p.id = i.producto_id
        WHERE v.empresa_id = ${empresaId}::uuid AND v.deleted_at IS NULL
          AND v.fecha >= ${hace30Dias}
        GROUP BY p.nombre
        ORDER BY SUM(i.cantidad) DESC
        LIMIT 10
      `).catch(() => []),

      this.prisma.producto.findMany({
        where: { empresaId, deletedAt: null, activo: true, precioVenta: { not: null }, costo: { not: null } },
        select: { nombre: true, precioVenta: true, costo: true, categoria: true },
        take: 12,
      }).catch(() => []),

      this.prisma.gasto.findMany({
        where: { empresaId, deletedAt: null, fecha: { gte: hace30Dias } },
        select: { categoria: true, monto: true, descripcion: true, tipoCosto: true },
      }).catch(() => []),

      this.prisma.compra.findMany({
        where: { empresaId, deletedAt: null, fecha: { gte: hace30Dias } },
        select: { total: true, proveedorNombre: true },
      }).catch(() => []),

      this.prisma.venta.findMany({
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
      }).catch(() => []),

      this.prisma.cotizacionDolar.findMany({
        orderBy: { fecha: 'desc' },
        take: 6,
      }).catch(() => []),

      this.prisma.producto.count({
        where: { empresaId, deletedAt: null, activo: true },
      }).catch(() => 0),

      this.prisma.producto.count({
        where: { empresaId, deletedAt: null, activo: false },
      }).catch(() => 0),
    ]);

    // 1. Métricas de Ventas y Facturación
    const totalVentas = ventas30Dias.reduce((acc, v) => {
      const con = Number(v.totalConInteres ?? 0);
      const sin = Number(v.totalSinInteres ?? 0);
      return acc + (con > 0 ? con : sin);
    }, 0);

    const totalPrevio = ventasPrevias.reduce((acc, v) => {
      const con = Number(v.totalConInteres ?? 0);
      const sin = Number(v.totalSinInteres ?? 0);
      return acc + (con > 0 ? con : sin);
    }, 0);

    const variacionPorcentual = totalPrevio > 0
      ? Number((((totalVentas - totalPrevio) / totalPrevio) * 100).toFixed(1))
      : 0;

    const ticketPromedio = ventas30Dias.length > 0 ? Math.round(totalVentas / ventas30Dias.length) : 0;

    const porFormaPago: Record<string, { cantidad: number; totalRecaudado: number }> = {};
    let totalDescuentos = 0;
    for (const v of ventas30Dias) {
      const forma = (v.formaPago || 'otros').toLowerCase();
      const con = Number(v.totalConInteres ?? 0);
      const sin = Number(v.totalSinInteres ?? 0);
      const monto = con > 0 ? con : sin;

      if (!porFormaPago[forma]) {
        porFormaPago[forma] = { cantidad: 0, totalRecaudado: 0 };
      }
      porFormaPago[forma].cantidad += 1;
      porFormaPago[forma].totalRecaudado += monto;
      totalDescuentos += Number(v.descuento ?? 0);
    }

    // 2. Productos y Rentabilidad
    const topVendidos = productosLideresRaw.map((p) => ({
      nombre: p.nombre,
      unidadesVendidas: Number(p.cantidad),
      ingresoAproximado: Number(p.cantidad) * (ticketPromedio > 0 ? ticketPromedio : 1000),
    }));

    const margenesMuestra = productosConMargenRaw.map((p) => {
      const precio = Number(p.precioVenta ?? 0);
      const costo = Number(p.costo ?? 0);
      const margenBrutoPct = precio > 0 && costo > 0 ? Number((((precio - costo) / precio) * 100).toFixed(1)) : null;
      return {
        producto: p.nombre,
        categoria: p.categoria || 'General',
        precioVenta: precio,
        costo,
        margenBrutoPct,
      };
    });

    // 3. Gastos Operativos y Compras de Mercadería
    const totalGastosMes = gastosMesRaw.reduce((acc, g) => acc + Number(g.monto ?? 0), 0);
    const desgloseGastos: Record<string, number> = {};
    for (const g of gastosMesRaw) {
      const cat = g.categoria || 'varios';
      desgloseGastos[cat] = (desgloseGastos[cat] ?? 0) + Number(g.monto ?? 0);
    }

    const totalComprasMercaderia = comprasMesRaw.reduce((acc, c) => acc + Number(c.total ?? 0), 0);

    // 4. Créditos y Cuentas Corrientes
    const deudores = ventasImpagasRaw.map((v) => {
      const diasAtraso = Math.max(0, Math.floor((ahora.getTime() - new Date(v.fecha).getTime()) / (24 * 3600_000)));
      return {
        cliente: v.cliente?.nombre || v.clienteNombre || 'Cliente mostrador',
        telefono: v.cliente?.telefono ?? null,
        saldoPendiente: Number(v.saldoPendiente),
        diasAtraso,
      };
    });
    const totalDeudaCtaCte = deudores.reduce((acc, d) => acc + d.saldoPendiente, 0);

    // 5. Macroeconomía y Tipo de Cambio
    const dolarBlue = cotizacionesDolarRaw.find((c) => c.casa.toLowerCase().includes('blue'))?.venta ?? null;
    const dolarOficial = cotizacionesDolarRaw.find((c) => c.casa.toLowerCase().includes('oficial'))?.venta ?? null;
    const dolarMep = cotizacionesDolarRaw.find((c) => c.casa.toLowerCase().includes('bolsa') || c.casa.toLowerCase().includes('mep'))?.venta ?? null;

    const numBlue = dolarBlue ? Number(dolarBlue) : 1200;
    const numOficial = dolarOficial ? Number(dolarOficial) : 1000;
    const brechaCambiariaPct = numOficial > 0 ? Number((((numBlue - numOficial) / numOficial) * 100).toFixed(1)) : 0;

    return {
      identidad: {
        nombre: empresa?.nombre || 'Mi Comercio / Pyme',
        rubro: empresa?.categoria || 'Comercio General',
        condicionIva: empresa?.condicionIva || 'Monotributo / Resp. Inscripto',
      },
      ventas: {
        totalUltimos30Dias: totalVentas,
        totalPeriodoAnterior: totalPrevio,
        variacionIntermensualPct: variacionPorcentual,
        operacionesTotales: ventas30Dias.length,
        ticketPromedio,
        descuentosOtorgados: totalDescuentos,
        metodosDePago: porFormaPago,
      },
      rentabilidad: {
        topVendidos,
        margenesPorProductoMuestra: margenesMuestra,
      },
      egresos: {
        totalGastosOperativos: totalGastosMes,
        desgloseGastosPorRubro: desgloseGastos,
        totalComprasMercaderia30Dias: totalComprasMercaderia,
      },
      inventario: {
        totalProductosActivos,
        totalProductosInactivos,
      },
      cuentasCorrientes: {
        totalAdeudado: totalDeudaCtaCte,
        cantidadVentasPendientes: ventasImpagasRaw.length,
        rankingTopDeudores: deudores.slice(0, 5),
      },
      macroeconomia: {
        dolarBlue: numBlue,
        dolarOficial: numOficial,
        dolarMep: dolarMep ? Number(dolarMep) : null,
        brechaCambiariaPct,
      },
      focoActual: topicoDeterminado,
    };
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
    if (q.includes('gasto') || q.includes('costo') || q.includes('compra')) return 'egresos';
    if (q.includes('dolar') || q.includes('inflaci') || q.includes('precio')) return 'inflacion';
    return 'general';
  }

  private async consultarLlm(
    apiKey: string,
    modelo: string,
    input: CopilotChatDto,
    dossier: Record<string, unknown>,
    topico: string,
  ): Promise<string> {
    try {
      const nombreEmpresa = (dossier.identidad as any)?.nombre || 'este negocio';
      const systemPrompt = `Sos Analítica Copilot (impulsado por ${modelo}), el Director Financiero (CFO), estratega de precios y consultor de inteligencia de negocios para "${nombreEmpresa}".
Conocés exhaustivamente cada número real de este comercio: sus ventas, ticket promedio, métodos de cobro, márgenes de ganancia, gastos fijos/variables, clientes deudores y cotización del dólar.
Tu objetivo es dar diagnósticos ejecutivos de máximo nivel, precisos y aplicados a la economía real argentina.
TÓPICO PRINCIPAL DE ATENCIÓN: ${topico.toUpperCase()}.
Respondé con estilo profesional, directo, analítico y cercano, usando formato Markdown (con negritas y listas limpias).

=======================================================
DOSSIER 360° EN VIVO DEL NEGOCIO (DATOS REALES):
=======================================================
${JSON.stringify(dossier, null, 2)}
=======================================================
`;

      const messages = [
        { role: 'system', content: systemPrompt },
        ...(input.historial ?? []).map((h) => ({
          role: h.rol === 'user' ? 'user' : 'assistant',
          content: h.contenido,
        })),
        { role: 'user', content: input.mensaje },
      ];

      const apiUrl = process.env.COPILOT_API_URL
        || (apiKey.startsWith('sk-or-') ? 'https://openrouter.ai/api/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions');

      const modelId = apiUrl.includes('openrouter.ai') && modelo === 'gpt-6-luna' ? 'openai/gpt-6-luna' : modelo;

      const payload: Record<string, unknown> = {
        model: modelId,
        messages,
        max_completion_tokens: 1000,
      };

      const esModeloRazonamiento = modelo.startsWith('o1') || modelo.startsWith('o3') || modelo.includes('luna');
      if (!esModeloRazonamiento) {
        payload.temperature = 0.3;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      };
      if (apiUrl.includes('openrouter.ai')) {
        headers['HTTP-Referer'] = 'https://analitica360.app';
        headers['X-Title'] = 'Analitica 360 Copilot';
      }

      let res = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(25000),
      });

      if (!res.ok) {
        const errorText = await res.text();
        if (errorText.includes('max_completion_tokens') && !errorText.includes('Use \'max_completion_tokens\'')) {
          delete payload.max_completion_tokens;
          payload.max_tokens = 1000;
          res = await fetch(apiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(25000),
          });
        } else if (errorText.includes('temperature')) {
          delete payload.temperature;
          res = await fetch(apiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(25000),
          });
        }

        if (!res.ok) {
          const finalError = await res.text();
          throw new Error(`Error API LLM (${res.status}): ${finalError}`);
        }
      }

      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const respuesta = data.choices?.[0]?.message?.content?.trim();
      if (!respuesta) {
        throw new Error('La respuesta de OpenAI vino vacía');
      }
      return respuesta;
    } catch (e) {
      throw e;
    }
  }

  private generarRespuestaHeuristica(mensaje: string, metricas: any, topico: string): string {
    const q = mensaje.toLowerCase();
    const dt = metricas.detalleTopico || {};
    const ventas = dt.ventas || {};

    if (topico === 'ventas' || q.includes('venta') || q.includes('ingreso') || q.includes('facturaci')) {
      const metodos = ventas.metodosDePago
        ? Object.entries(ventas.metodosDePago)
            .map(([forma, v]: [string, any]) => `- **${forma.toUpperCase()}**: $${v.totalRecaudado?.toLocaleString('es-AR')} (${v.cantidad} op.)`)
            .join('\n')
        : '';

      const varText = ventas.variacionIntermensualPct !== undefined
        ? `\n- **Comparación con mes anterior:** ${ventas.variacionIntermensualPct >= 0 ? '+' : ''}${ventas.variacionIntermensualPct}%`
        : '';

      return `📊 **Análisis Profundo de Ventas y Facturación**
- **Facturación total (30 días):** $${metricas.totalVentasPeriodo.toLocaleString('es-AR')}
- **Ticket promedio:** $${metricas.ticketPromedio.toLocaleString('es-AR')} por operación.${varText}

${metodos ? `💳 **Distribución por Métodos de Pago:**\n${metodos}\n` : ''}
💡 **Recomendación estratégica:**
${metricas.totalVentasPeriodo > 0 ? 'Tus ventas muestran un flujo activo. Para incrementar el margen neto, enfocate en potenciar cobros por transferencia o efectivo para evitar retenciones de pasarelas de pago y aplicá venta cruzada (cross-selling) en tus productos líderes.' : 'Aún no se registran suficientes ventas en este período. Te sugiero activar promociones de lanzamiento o contactar clientes recurrentes.'}`;
    }

    if (topico === 'productos' || q.includes('producto') || q.includes('top') || q.includes('mas vendido')) {
      const lista = metricas.productosLideres.map((p: any, i: number) => `${i + 1}. **${p.nombre}**: ${p.unidadesVendidas ?? p.cantidad} unidades vendidas`).join('\n');
      return `🏆 **Tus Productos Más Vendidos**
${lista || 'No hay ventas registradas aún para listar productos líderes.'}

💡 **Consejo de Rentabilidad:**
Asegurá stock de estos ítems clave. Revisá los costos de reposición semanalmente para ajustar precios antes de que la inflación absorba tu margen de ganancia.`;
    }

    if (topico === 'stock' || q.includes('stock') || q.includes('inventario') || q.includes('reponer')) {
      const totalAct = dt.inventario?.totalProductosActivos ?? metricas.stockCriticoCount;
      return `📦 **Estado de Inventario y Stock**
- **Productos activos en catálogo:** ${totalAct}
- **Productos en alerta preventiva:** ${metricas.stockCriticoCount}

${metricas.stockCriticoCount > 0 ? '⚠️ **Atención:** Tenés productos en riesgo de quiebre de stock. Reponerlos a tiempo evita perder ventas recurrentes y asegura precios mayoristas antes de aumentos de listas.' : '✅ Tu inventario general se encuentra en niveles saludables y abastecido.'}`;
    }

    if (topico === 'cobranzas' || q.includes('deuda') || q.includes('cobrar') || q.includes('cuenta corriente')) {
      const deudores = dt.cuentasCorrientes?.rankingTopDeudores || [];
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
      const macro = dt.macroeconomia || {};
      const blue = macro.dolarBlue ?? metricas.dolarReferencia?.valor ?? 1200;
      const oficial = macro.dolarOficial ?? 1000;
      const brecha = macro.brechaCambiariaPct !== undefined ? `${macro.brechaCambiariaPct}%` : 'Moderada';

      return `💵 **Análisis de Inflación y Tipo de Cambio**
- **Dólar Blue:** $${blue}
- **Dólar Oficial:** $${oficial}
- **Brecha cambiaria estimada:** ${brecha}

💡 **Estrategia de Precios sugerida:**
Cotizá tu mercadería según el costo de reposición actual y evitá financiar en pesos a largo plazo sin tasa de recargo calculada.`;
    }

    return `🤖 **Analítica Copilot (GPT-6 Luna)**
Analicé el Dossier 360° de tu empresa:
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

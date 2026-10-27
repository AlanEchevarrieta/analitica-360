import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { PrismaService } from '../../database/prisma.service.js';
import { LakeService } from '../lake/lake.service.js';
import type {
  ItemMercadoScrapeado,
  MetricasMercado,
  ResultadoBenchmarkProducto,
  EscaneoLoteInput,
  EstadoCompetitivo,
} from './radar-precios.types.js';

@Injectable()
export class RadarPreciosService {
  private readonly logger = new Logger(RadarPreciosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lakeService: LakeService,
  ) {}

  /**
   * Búsqueda pública en la API de catálogo de MercadoLibre (MLA - Argentina).
   */
  async buscarEnMercadoLibre(query: string, barcode?: string | null): Promise<ItemMercadoScrapeado[]> {
    const items: ItemMercadoScrapeado[] = [];
    const mlToken = process.env.MERCADOLIBRE_ACCESS_TOKEN || process.env.ML_ACCESS_TOKEN;
    const reqHeaders: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'application/json',
    };
    if (mlToken) {
      reqHeaders['Authorization'] = `Bearer ${mlToken}`;
    }

    // 1. Si hay código de barras, intentamos primero búsqueda por barcode
    if (barcode && barcode.trim().length >= 8) {
      try {
        const urlBarcode = `https://api.mercadolibre.com/sites/MLA/search?barcode=${encodeURIComponent(barcode.trim())}&limit=20`;
        const res = await fetch(urlBarcode, {
          headers: reqHeaders,
          signal: AbortSignal.timeout(6000),
        });

        if (res.ok) {
          const data = (await res.json()) as any;
          if (Array.isArray(data.results) && data.results.length > 0) {
            for (const r of data.results) {
              if (typeof r.price === 'number' && r.price > 0) {
                items.push({
                  titulo: r.title,
                  precio: Number(r.price),
                  moneda: r.currency_id ?? 'ARS',
                  vendedor: r.seller?.nickname ?? 'MercadoLibre Seller',
                  url: r.permalink,
                  fuente: 'mercadolibre',
                  reputacionVendedor: r.seller?.seller_reputation?.level_id ?? undefined,
                  stock: r.available_quantity,
                  condicion: r.condition,
                  foto: r.thumbnail,
                });
              }
            }
          }
        }
      } catch (err: any) {
        this.logger.warn(`Error buscando por barcode [${barcode}] en ML: ${err?.message}`);
      }
    }

    // 2. Si no hubo resultados por barcode o no hay barcode, buscamos por query de texto
    if (items.length < 3 && query && query.trim().length >= 2) {
      try {
        const queryLimpia = query
          .replace(/[#,/\\_-]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        const urlQuery = `https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent(queryLimpia)}&limit=25`;
        const res = await fetch(urlQuery, {
          headers: reqHeaders,
          signal: AbortSignal.timeout(6000),
        });

        if (res.ok) {
          const data = (await res.json()) as any;
          if (Array.isArray(data.results)) {
            for (const r of data.results) {
              if (typeof r.price === 'number' && r.price > 0) {
                // Evitamos duplicar por permalink si ya existía
                if (!items.some((it) => it.url === r.permalink)) {
                  items.push({
                    titulo: r.title,
                    precio: Number(r.price),
                    moneda: r.currency_id ?? 'ARS',
                    vendedor: r.seller?.nickname ?? 'MercadoLibre Seller',
                    url: r.permalink,
                    fuente: 'mercadolibre',
                    reputacionVendedor: r.seller?.seller_reputation?.level_id ?? undefined,
                    stock: r.available_quantity,
                    condicion: r.condition,
                    foto: r.thumbnail,
                  });
                }
              }
            }
          }
        }
      } catch (err: any) {
        this.logger.warn(`Error buscando por texto [${query}] en ML: ${err?.message}`);
      }
    }

    // 3. Si la API de ML no devolvió items (por 403 de Cloudflare/falta de token o sin resultados directos),
    // generamos el enlace directo al catálogo real de MercadoLibre para que el usuario pueda abrirlo con 1 clic.
    if (items.length === 0 && (query || barcode)) {
      const q = (query || barcode || '').replace(/[#,/\\_-]/g, ' ').replace(/\s+/g, ' ').trim();
      if (q) {
        const urlDirecta = `https://listado.mercadolibre.com.ar/${encodeURIComponent(q.replace(/\s+/g, '-'))}`;
        items.push({
          titulo: `Explorar publicaciones de "${q}" en MercadoLibre`,
          precio: 0,
          moneda: 'ARS',
          vendedor: 'MercadoLibre Argentina',
          url: urlDirecta,
          fuente: 'mercadolibre',
        });
      }
    }

    return items;
  }

  /**
   * Scrappage directo de microdatos estructurados schema.org/Product en URLs de competidores.
   */
  async scrappearTiendaCompetidor(url: string): Promise<ItemMercadoScrapeado | null> {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) return null;
      const html = await res.text();
      const $ = cheerio.load(html);

      // Intentamos extraer JSON-LD
      let precioEncontrado: number | null = null;
      let tituloEncontrado: string | null = null;
      let monedaEncontrada = 'ARS';

      $('script[type="application/ld+json"]').each((_, elem) => {
        try {
          const text = $(elem).text();
          const json = JSON.parse(text);
          const objetos = Array.isArray(json) ? json : [json];

          for (const obj of objetos) {
            if (obj['@type'] === 'Product' || obj.name) {
              if (obj.name && !tituloEncontrado) tituloEncontrado = String(obj.name);
              const offers = obj.offers;
              if (offers) {
                const offerList = Array.isArray(offers) ? offers : [offers];
                for (const off of offerList) {
                  const p = Number(off.price ?? off.lowPrice);
                  if (!Number.isNaN(p) && p > 0) {
                    precioEncontrado = p;
                    if (off.priceCurrency) monedaEncontrada = String(off.priceCurrency);
                    break;
                  }
                }
              }
            }
          }
        } catch {
          // Ignorar JSON malformados
        }
      });

      // Fallback a etiquetas meta OpenGraph
      if (!precioEncontrado) {
        const ogPrice =
          $('meta[property="product:price:amount"]').attr('content') ??
          $('meta[property="og:price:amount"]').attr('content');
        if (ogPrice) {
          const parsed = Number.parseFloat(ogPrice.replace(/[^0-9.]/g, ''));
          if (!Number.isNaN(parsed) && parsed > 0) precioEncontrado = parsed;
        }
      }

      if (!tituloEncontrado) {
        tituloEncontrado =
          $('meta[property="og:title"]').attr('content') ?? $('title').text().trim() ?? 'Producto Competidor';
      }

      if (precioEncontrado && precioEncontrado > 0) {
        return {
          titulo: tituloEncontrado,
          precio: precioEncontrado,
          moneda: monedaEncontrada,
          vendedor: new URL(url).hostname,
          url,
          fuente: 'tienda_competidor',
        };
      }
    } catch (err: any) {
      this.logger.warn(`Error scrapeando tienda [${url}]: ${err?.message}`);
    }

    return null;
  }

  /**
   * Pipeline estadístico con filtro Intercuartil (IQR) para descartar outliers/falsos positivos.
   */
  calcularMetricasConFiltroIQR(precioLocal: number, items: ItemMercadoScrapeado[]): MetricasMercado {
    const totalOriginal = items.length;
    if (totalOriginal === 0) {
      return {
        precioMinimo: precioLocal,
        precioMediana: precioLocal,
        precioPromedio: precioLocal,
        precioMaximo: precioLocal,
        muestraTotal: 0,
        muestraFiltrada: 0,
        brechaPorcentaje: 0,
        estadoCompetitivo: 'alineado',
        items: [],
      };
    }

    // 1. Filtrado preliminar de límites lógicos respecto al precio local
    let filtrados = items.filter((it) => {
      if (it.precio <= 0) return false;
      if (precioLocal > 0) {
        // Descartamos si es menor al 20% o mayor al 450% del precio local
        if (it.precio < precioLocal * 0.2 || it.precio > precioLocal * 4.5) return false;
      }
      return true;
    });

    if (filtrados.length === 0) {
      filtrados = items.filter((it) => it.precio > 0);
    }

    if (filtrados.length === 0) {
      return {
        precioMinimo: precioLocal,
        precioMediana: precioLocal,
        precioPromedio: precioLocal,
        precioMaximo: precioLocal,
        muestraTotal: totalOriginal,
        muestraFiltrada: 0,
        brechaPorcentaje: 0,
        estadoCompetitivo: 'alineado',
        items: items.slice(0, 5),
      };
    }

    // 2. Filtro IQR (Rango Intercuartil) si tenemos 4 o más observaciones
    if (filtrados.length >= 4) {
      const preciosOrdenados = filtrados.map((it) => it.precio).sort((a, b) => a - b);
      const q1Index = Math.floor(preciosOrdenados.length * 0.25);
      const q3Index = Math.floor(preciosOrdenados.length * 0.75);
      const q1 = preciosOrdenados[q1Index];
      const q3 = preciosOrdenados[q3Index];
      const iqr = q3 - q1;

      const limiteInferior = Math.max(0, q1 - 1.5 * iqr);
      const limiteSuperior = q3 + 1.5 * iqr;

      const sinOutliers = filtrados.filter((it) => it.precio >= limiteInferior && it.precio <= limiteSuperior);
      if (sinOutliers.length >= 2) {
        filtrados = sinOutliers;
      }
    }

    // 3. Métricas consolidadas
    const preciosFinales = filtrados.map((it) => it.precio).sort((a, b) => a - b);
    const precioMinimo = preciosFinales[0];
    const precioMaximo = preciosFinales[preciosFinales.length - 1];
    const precioPromedio = Math.round(preciosFinales.reduce((acc, p) => acc + p, 0) / preciosFinales.length);

    // Mediana
    const mitad = Math.floor(preciosFinales.length / 2);
    const precioMediana =
      preciosFinales.length % 2 !== 0
        ? preciosFinales[mitad]
        : Math.round((preciosFinales[mitad - 1] + preciosFinales[mitad]) / 2);

    // Brecha porcentual vs mediana
    let brechaPorcentaje = 0;
    if (precioMediana > 0 && precioLocal > 0) {
      brechaPorcentaje = Math.round(((precioLocal - precioMediana) / precioMediana) * 1000) / 10;
    }

    // Clasificación de competitividad
    let estadoCompetitivo: EstadoCompetitivo = 'alineado';
    if (brechaPorcentaje < -8) {
      estadoCompetitivo = 'barato_margen_recuperable';
    } else if (brechaPorcentaje > 8) {
      estadoCompetitivo = 'caro_fuera_de_mercado';
    }

    return {
      precioMinimo,
      precioMediana,
      precioPromedio,
      precioMaximo,
      muestraTotal: totalOriginal,
      muestraFiltrada: filtrados.length,
      brechaPorcentaje,
      estadoCompetitivo,
      items: filtrados.slice(0, 10), // Guardamos los 10 mejores representantes
    };
  }

  /**
   * Escanea un producto puntual por ID, calcula su benchmark y lo ingesta en el Lakehouse.
   */
  async escanearProducto(empresaId: string, productoId: string): Promise<ResultadoBenchmarkProducto> {
    const producto = await this.prisma.producto.findFirst({
      where: { id: productoId, empresaId, deletedAt: null },
    });

    if (!producto) {
      throw new NotFoundException(`Producto ${productoId} no encontrado en la empresa.`);
    }

    const precioLocal = Number(producto.precioVenta ?? 0);
    const costoLocal = producto.costo ? Number(producto.costo) : null;

    // Buscamos publicaciones en MercadoLibre y fuentes públicas
    const itemsScrapeados = await this.buscarEnMercadoLibre(producto.nombre, producto.codigoBarra);

    // Filtro IQR y métricas
    const metricas = this.calcularMetricasConFiltroIQR(precioLocal, itemsScrapeados);

    const resultado: ResultadoBenchmarkProducto = {
      productoId: producto.id,
      nombre: producto.nombre,
      codigoBarra: producto.codigoBarra,
      sku: producto.sku,
      precioLocal,
      costoLocal,
      metricas,
      fechaEscaneo: new Date().toISOString(),
      fuentePrincipal: 'mercadolibre',
    };

    // Ingestamos el evento inmutable en el Lakehouse
    await this.lakeService.ingestarEvento({
      empresaId,
      tipoEvento: 'benchmark_precio_mercado',
      entidadId: producto.id,
      payload: resultado as any,
      metadata: {
        codigoBarra: producto.codigoBarra,
        brechaPorcentaje: metricas.brechaPorcentaje,
        estadoCompetitivo: metricas.estadoCompetitivo,
      },
    });

    return resultado;
  }

  /**
   * Escanea un lote de productos (ej. los más vendidos o del catálogo activo).
   */
  async escanearLote(empresaId: string, input?: EscaneoLoteInput): Promise<ResultadoBenchmarkProducto[]> {
    const limite = Math.min(Math.max(input?.limite ?? 12, 1), 30);

    const where: any = { empresaId, deletedAt: null, activo: true };
    if (input?.categoriaId) where.categoriaId = input.categoriaId;
    if (input?.soloConCodigoBarra) where.codigoBarra = { not: null };

    const productos = await this.prisma.producto.findMany({
      where,
      take: limite,
      orderBy: { createdAt: 'desc' },
    });

    const resultados: ResultadoBenchmarkProducto[] = [];

    for (const prod of productos) {
      try {
        const res = await this.escanearProducto(empresaId, prod.id);
        resultados.push(res);
        // Pausa ligera de 150ms entre llamadas consecutivas para cortesía HTTP
        await new Promise((resolve) => setTimeout(resolve, 150));
      } catch (err: any) {
        this.logger.error(`Error escaneando producto ${prod.id} en lote: ${err?.message}`);
      }
    }

    return resultados;
  }

  /**
   * Obtiene las comparativas más recientes guardadas en el Lakehouse para la empresa.
   */
  async obtenerComparativas(empresaId: string): Promise<ResultadoBenchmarkProducto[]> {
    // Leemos los eventos de benchmark más recientes de lake_eventos
    const eventos = await this.prisma.lakeEvento.findMany({
      where: {
        empresaId,
        tipoEvento: 'benchmark_precio_mercado',
      },
      orderBy: { fecha: 'desc' },
      take: 100,
    });

    // Tomamos el evento más reciente por cada producto
    const mapaPorProducto = new Map<string, ResultadoBenchmarkProducto>();

    for (const ev of eventos) {
      const prodId = ev.entidadId;
      if (!prodId || mapaPorProducto.has(prodId)) continue;

      const payload = ev.payload as unknown as ResultadoBenchmarkProducto;
      if (payload && payload.productoId) {
        mapaPorProducto.set(prodId, payload);
      }
    }

    // Cruzamos con el catálogo para refrescar el precio local actual en caso de que haya cambiado
    const ids = Array.from(mapaPorProducto.keys());
    if (ids.length > 0) {
      const prodsActuales = await this.prisma.producto.findMany({
        where: { id: { in: ids }, empresaId },
        select: { id: true, precioVenta: true, nombre: true, costo: true },
      });

      for (const p of prodsActuales) {
        const item = mapaPorProducto.get(p.id);
        if (item) {
          const precioActual = Number(p.precioVenta ?? 0);
          item.precioLocal = precioActual;
          item.costoLocal = p.costo ? Number(p.costo) : null;
          // Recalculamos brecha con la mediana existente
          if (item.metricas.precioMediana > 0 && precioActual > 0) {
            item.metricas.brechaPorcentaje =
              Math.round(((precioActual - item.metricas.precioMediana) / item.metricas.precioMediana) * 1000) / 10;
            if (item.metricas.brechaPorcentaje < -8) {
              item.metricas.estadoCompetitivo = 'barato_margen_recuperable';
            } else if (item.metricas.brechaPorcentaje > 8) {
              item.metricas.estadoCompetitivo = 'caro_fuera_de_mercado';
            } else {
              item.metricas.estadoCompetitivo = 'alineado';
            }
          }
        }
      }
    }

    return Array.from(mapaPorProducto.values());
  }

  /**
   * Alinea el precio del producto al valor sugerido del mercado y registra en historial.
   */
  async alinearPrecio(
    empresaId: string,
    productoId: string,
    nuevoPrecio: number,
    motivo?: string,
  ): Promise<{ productoId: string; precioAnterior: number; precioNuevo: number }> {
    if (typeof nuevoPrecio !== 'number' || nuevoPrecio <= 0) {
      throw new BadRequestException('El nuevo precio debe ser un número positivo.');
    }

    const producto = await this.prisma.producto.findFirst({
      where: { id: productoId, empresaId, deletedAt: null },
    });

    if (!producto) {
      throw new NotFoundException(`Producto ${productoId} no encontrado.`);
    }

    const precioAnterior = Number(producto.precioVenta ?? 0);

    // Actualizamos precio en DB
    await this.prisma.producto.update({
      where: { id: productoId },
      data: { precioVenta: nuevoPrecio },
    });

    // Guardamos en el historial de precios
    await this.prisma.precioHistorial.create({
      data: {
        empresaId,
        productoId,
        precioVenta: nuevoPrecio,
        costo: producto.costo ?? 0,
      },
    });

    // Ingestamos evento en el Lakehouse
    await this.lakeService.ingestarEvento({
      empresaId,
      tipoEvento: 'precio_modificado',
      entidadId: productoId,
      payload: {
        productoId,
        nombre: producto.nombre,
        precioAnterior,
        precioNuevo: nuevoPrecio,
        motivo: motivo ?? 'Alineación de precio con mediana de mercado (Radar de Precios)',
        origen: 'radar_mercado',
      },
    });

    return {
      productoId,
      precioAnterior,
      precioNuevo: nuevoPrecio,
    };
  }
}

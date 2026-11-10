import { ACACIA_CONFIG_DEFAULT, MOCK_PRODUCTOS } from "./mock-data";
import type { CrearPedidoRequest, Producto, ResultadoPedido, SitioConfig } from "./types";

const API_BASE = (process.env.ANALITICA_API_URL || "http://localhost:3001").replace(/\/+$/, "");
const EMPRESA_ID = process.env.ACACIA_EMPRESA_ID || ACACIA_CONFIG_DEFAULT.empresaId;

/** Obtiene la configuración pública de Acacia Mates desde Analítica 360 */
export async function obtenerConfigSitio(): Promise<SitioConfig> {
  try {
    const res = await fetch(`${API_BASE}/tienda-sitio/${EMPRESA_ID}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      return ACACIA_CONFIG_DEFAULT;
    }
    const data = await res.json();
    return {
      ...ACACIA_CONFIG_DEFAULT,
      ...data,
      empresaId: EMPRESA_ID,
    };
  } catch {
    return ACACIA_CONFIG_DEFAULT;
  }
}

/** Obtiene el catálogo completo de productos */
export async function obtenerCatalogo(): Promise<Producto[]> {
  try {
    const res = await fetch(`${API_BASE}/tienda/${EMPRESA_ID}/catalogo`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) {
      return MOCK_PRODUCTOS;
    }
    const data = await res.json();
    const productosApi = data.productos || data;

    if (!Array.isArray(productosApi) || productosApi.length === 0) {
      return MOCK_PRODUCTOS;
    }

    // Mapear el catálogo devuelto por NestJS a la estructura con metadata de Acacia
    return productosApi.map((p: Record<string, unknown>, idx: number) => {
      const mockMatch = MOCK_PRODUCTOS.find((m) => m.id === p.id || m.nombre.toLowerCase() === String(p.nombre).toLowerCase());
      const nombre = String(p.nombre || "Mate Artesanal");
      const categoria = String(p.categoria || mockMatch?.categoria || "General");
      const precio = Number(p.precio || p.precio_venta || mockMatch?.precio || 15000);
      const precioLista = Number(p.precioLista || mockMatch?.precioLista || precio);
      const descuentoPct = Number(p.descuentoPct || mockMatch?.descuentoPct || 0);

      const slugBase = nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      const slug = `${slugBase || "producto"}-${String(p.id).slice(0, 8)}`;

      return {
        id: String(p.id),
        nombre,
        categoria,
        categoriaSlug: categoria.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        precio,
        precioLista,
        descuentoPct,
        imagenes: (Array.isArray(p.imagenes) && p.imagenes.length > 0)
          ? (p.imagenes as string[])
          : (mockMatch?.imagenes || [
              `https://images.unsplash.com/photo-${1598033129183 + (idx * 1000)}?auto=format&fit=crop&w=1200&q=85`,
            ]),
        miniaturas: (Array.isArray(p.miniaturas) && p.miniaturas.length > 0)
          ? (p.miniaturas as string[])
          : (mockMatch?.miniaturas || [
              `https://images.unsplash.com/photo-${1598033129183 + (idx * 1000)}?auto=format&fit=crop&w=600&q=80`,
            ]),
        stock: Number(p.stock ?? 10),
        vendidos: Number(p.vendidos ?? 25),
        slug,
        descripcion: String(p.descripcion || mockMatch?.descripcion || "Pieza artesanal confeccionada con técnicas nobles y materiales seleccionados a mano."),
        detalles: mockMatch?.detalles || {
          material: "Materiales nobles seleccionados",
          origen: "Taller artesanal",
          curado: "Consulte instrucciones tradicionales",
          pesoGramos: 350,
        },
        variantes: (Array.isArray(p.variantes) ? p.variantes : mockMatch?.variantes || []) as Producto["variantes"],
      };
    });
  } catch {
    return MOCK_PRODUCTOS;
  }
}

/** Obtiene un producto por su slug */
export async function obtenerProductoPorSlug(slug: string): Promise<Producto | null> {
  const catalogo = await obtenerCatalogo();
  const producto = catalogo.find((p) => p.slug === slug);
  if (producto) return producto;

  // Fallback por ID si el slug incluye el prefijo del ID
  return catalogo.find((p) => slug.includes(p.id.slice(0, 8))) || null;
}

/** Crea un pedido en Analítica 360 */
export async function crearPedidoApi(req: CrearPedidoRequest): Promise<ResultadoPedido> {
  try {
    const res = await fetch(`${API_BASE}/tienda/${req.empresaId}/pedidos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cliente: {
          nombre: req.datosEnvio.nombre,
          email: req.datosEnvio.email,
          telefono: req.datosEnvio.telefono,
        },
        envio: {
          tipo: "domicilio",
          direccion: `${req.datosEnvio.calle} ${req.datosEnvio.numero}${req.datosEnvio.piso ? `, ${req.datosEnvio.piso}` : ""}`,
          localidad: req.datosEnvio.ciudad,
          provincia: req.datosEnvio.provincia,
          codigoPostal: req.datosEnvio.codigoPostal,
          costo: req.costoEnvio || 0,
          notas: req.datosEnvio.notas || "",
        },
        metodoPago: req.metodoPago,
        cuponCodigo: req.cuponCodigo || null,
        items: req.items,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        ok: true,
        numeroPedido: data.numeroPedido || data.numero || `#AC-${Math.floor(1000 + Math.random() * 9000)}`,
        pedidoId: data.id || data.pedidoId,
        total: data.total,
        pagoUrl: data.pagoUrl || null,
      };
    }
  } catch (err) {
    console.error("Error conectando con API de Analítica 360:", err);
  }

  // Fallback controlado si la API no está en línea
  const randomNum = `#AC-${Math.floor(1000 + Math.random() * 9000)}`;
  const subtotal = req.items.reduce((acc, it) => acc + it.precioUnitario * it.cantidad, 0);
  const desc = req.metodoPago === "transferencia" ? subtotal * 0.1 : 0;
  const total = subtotal - desc + (req.costoEnvio || 0);

  return {
    ok: true,
    numeroPedido: randomNum,
    total,
    descuentoTransferencia: desc,
  };
}

import { formatoARS } from "./productos";

export const PROVINCIAS_AR = [
  "Buenos Aires",
  "CABA",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Córdoba",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucumán",
] as const;

export type DatosEnvio = {
  nombre: string;
  email: string;
  telefono: string;
  calle: string;
  numero: string;
  piso: string;
  ciudad: string;
  provincia: string;
  codigoPostal: string;
  notas: string;
};

export type ItemPedidoInput = {
  productoId: string;
  varianteId: string | null;
  cantidad: number;
  precioUnitario: number;
  nombre: string;
  varianteEtiqueta?: string;
};

export function armarDireccion(d: DatosEnvio) {
  const calleNro = `${d.calle.trim()} ${d.numero.trim()}`.trim();
  const piso = d.piso.trim() ? `, ${d.piso.trim()}` : "";
  return `${calleNro}${piso}`;
}

export function mensajeWhatsAppPedido(input: {
  numeroPedido: string;
  envio: DatosEnvio;
  items: { nombre: string; varianteEtiqueta?: string; cantidad: number; precio: number }[];
  total: number;
  cupon?: { codigo: string; descuento: number } | null;
  descuentoTransferencia?: number;
  formaPago?: "transferencia" | "a_coordinar";
}) {
  const lineas = input.items
    .map((i) => {
      const nombre = [i.nombre, i.varianteEtiqueta].filter(Boolean).join(" ");
      return `- ${i.cantidad}x ${nombre} — ${formatoARS(i.cantidad * i.precio)}`;
    })
    .join("\n");
  const dir = `${armarDireccion(input.envio)}, ${input.envio.ciudad}`;
  return `Hola! Quiero hacer el siguiente pedido:

📦 Productos:
${lineas}

📍 Datos de envío:
${input.envio.nombre}
${dir}

${input.cupon ? `🎟️ Cupón ${input.cupon.codigo}: −${formatoARS(input.cupon.descuento)}
` : ""}${input.descuentoTransferencia ? `🏦 Descuento por transferencia: −${formatoARS(input.descuentoTransferencia)}
` : ""}💰 Total: ${formatoARS(input.total)}${input.formaPago === "transferencia" ? " (pago por transferencia)" : ""}

N° Pedido: ${input.numeroPedido}`;
}


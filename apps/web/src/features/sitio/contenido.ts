import { PRECIO_MENSUAL, type Ciclo, type PlanPagoId } from "@/features/planes/planes";

/**
 * Textos y precios de la landing pública (analitica360.app).
 *
 * Precios: estrategia aprobada el 2026-10-05 (trimestral −15 %, anual −25 % con hasta
 * 6 cuotas sin interés; socios UCIM 1 mes gratis y −10/−25/−35 % por 24 meses).
 * PENDIENTE antes de publicar: aplicarla también al cobro (apps/api, módulos planes
 * y alianzas), para que lo que dice la landing sea lo que se cobra.
 */
export const DESCUENTO_CICLO: Record<Ciclo, number> = { mensual: 0, trimestral: 0.15, anual: 0.25 };
export const MESES: Record<Ciclo, number> = { mensual: 1, trimestral: 3, anual: 12 };
export const CUOTAS_ANUAL = 6;
export const DIAS_PRUEBA = 14;
export const UCIM = { mesesBeneficio: 24, descuento: { mensual: 0.1, trimestral: 0.25, anual: 0.35 } as Record<Ciclo, number> };

/** Precio por mes en ese ciclo, en pesos enteros. */
export function precioPorMes(plan: PlanPagoId, ciclo: Ciclo): number {
  return Math.round(PRECIO_MENSUAL[plan] * (1 - DESCUENTO_CICLO[ciclo]));
}

export function precioPeriodo(plan: PlanPagoId, ciclo: Ciclo): number {
  return precioPorMes(plan, ciclo) * MESES[ciclo];
}

export const WHATSAPP = (process.env.NEXT_PUBLIC_WHATSAPP_CONTACT ?? "").replace(/\D/g, "");
export const linkWhatsApp = (texto = "Hola, quiero conocer Analítica 360") =>
  WHATSAPP ? `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(texto)}` : "/sign-up";

export interface Modulo {
  id: string;
  titulo: string;
  bajada: string;
  puntos: string[];
  plan: "Todos los planes" | "Desde Pro" | "E-commerce";
}

export const MODULOS: Modulo[] = [
  {
    id: "ventas",
    titulo: "Ventas y caja",
    bajada: "Vendé en segundos desde la compu o el celular, con lector de códigos.",
    puntos: ["Efectivo, tarjeta, transferencia y cuotas con recargo", "Señas y saldos pendientes", "Devoluciones y cambios que vuelven al stock"],
    plan: "Todos los planes",
  },
  {
    id: "stock",
    titulo: "Stock e inventario",
    bajada: "Sabé qué tenés, dónde está y qué se está por terminar.",
    puntos: ["Variantes (talle, color) y varias ubicaciones", "Aviso de stock bajo", "Historial de cada movimiento, tipo kardex"],
    plan: "Todos los planes",
  },
  {
    id: "compras",
    titulo: "Compras y proveedores",
    bajada: "Cada compra actualiza el stock y el costo real de tus productos.",
    puntos: ["Costo promedio con flete e impuestos repartidos", "Ficha de cada proveedor con sus compras", "Ganancia real por venta"],
    plan: "Todos los planes",
  },
  {
    id: "clientes",
    titulo: "Clientes y cuenta corriente",
    bajada: "Conocé a quién le vendés y cobrá lo que te deben.",
    puntos: ["Cuenta corriente y listas de precios mayorista y minorista", "Segmentos y difusiones por WhatsApp", "Cumpleaños y clientes que dejaron de comprar"],
    plan: "Desde Pro",
  },
  {
    id: "analytics",
    titulo: "Analytics e Insights",
    bajada: "Entendé tu negocio con números claros, también en dólares.",
    puntos: ["Ventas, ganancia por producto y punto de equilibrio", "Pronósticos, combos y precio sugerido", "Botón $ / US$ con el dólar de cada día"],
    plan: "Desde Pro",
  },
  {
    id: "contabilidad",
    titulo: "Contabilidad y monotributo",
    bajada: "Los números contables salen solos de lo que ya cargás.",
    puntos: ["Estado de resultados, libro diario y balance", "Control del tope de tu categoría de monotributo", "Exportación para tu contador"],
    plan: "Desde Pro",
  },
  {
    id: "tienda",
    titulo: "Tienda online propia",
    bajada: "Tu catálogo en internet, conectado al mismo stock.",
    puntos: ["Con tu dominio o un subdominio gratis", "Ofertas, cupones y descuento por transferencia", "Cuentas de compradores y pedidos que llegan al sistema"],
    plan: "E-commerce",
  },
  {
    id: "informes",
    titulo: "Informes automáticos",
    bajada: "Cada semana te llega por email cómo viene tu negocio.",
    puntos: ["PDF semanal en todos los planes y mensual desde Pro", "Para vos, tus socios o tu contador", "Producción con recetas y kits, y pedidos con remito (Pro)"],
    plan: "Todos los planes",
  },
];

export const PASOS = [
  { titulo: "Creá tu cuenta", texto: `En 2 minutos y sin tarjeta. Tenés ${DIAS_PRUEBA} días con todo el plan Pro.` },
  { titulo: "Cargá tus productos", texto: "Uno por uno o todos juntos desde Excel. Si querés, te ayudamos a pasar tus datos." },
  { titulo: "Vendé y mirá tus números", texto: "Desde el primer día ves ventas, stock y ganancia, en la compu o en el celular." },
];

export const SEGURIDAD = [
  { titulo: "Copias de seguridad diarias", texto: "Tus datos se respaldan todos los días, también fuera del servidor." },
  { titulo: "Bitácora que no se puede alterar", texto: "Queda registrado quién hizo cada cambio y nadie puede borrarlo." },
  { titulo: "Tus datos son tuyos", texto: "Los exportás cuando quieras. No los vendemos ni los compartimos (Ley 25.326)." },
  { titulo: "Cada usuario con sus permisos", texto: "Decidís qué puede ver y hacer cada persona de tu equipo." },
];

export const PREGUNTAS = [
  { p: "¿Necesito tarjeta para probar?", r: `No. Creás la cuenta y tenés ${DIAS_PRUEBA} días gratis con todo el plan Pro, sin tarjeta y sin compromiso. Al terminar, elegís un plan o la cuenta queda en solo lectura: no perdés nada.` },
  { p: "¿Sirve para mi rubro?", r: "Sirve para cualquier comercio que venda productos: indumentaria, ferretería, almacén, artesanías, librería, cosmética, regalería y más. Si vendés en el local, en ferias y por internet, todo queda en el mismo lugar." },
  { p: "¿Puedo pasar mis datos desde Excel u otro sistema?", r: "Sí. Importás productos y clientes desde Excel, y si venís de otro sistema te ayudamos a pasar tu información." },
  { p: "¿Funciona en el celular?", r: "Sí. Funciona en el navegador de la compu, la tablet o el celular, y se puede instalar como una app. Para vender podés usar la cámara del celular como lector de códigos." },
  { p: "¿Mis datos están seguros?", r: "Hacemos copias de seguridad todos los días, la conexión va cifrada y cada cambio queda registrado en una bitácora que no se puede alterar. Los datos son tuyos: los exportás cuando quieras." },
  { p: "¿Cómo pago? ¿Hay cuotas?", r: `Pagás por mes, por trimestre (15 % menos) o por año (25 % menos). El anual se puede pagar en hasta ${CUOTAS_ANUAL} cuotas sin interés. Los precios son en pesos, más IVA.` },
  { p: "¿Puedo cambiar de plan o darme de baja?", r: "Sí, cuando quieras. Si te das de baja tenés 30 días para arrepentirte y descargar toda tu información." },
  { p: "¿Emite factura electrónica?", r: "La Factura C de ARCA está en camino. Mientras tanto, el sistema lleva el control de tu facturación contra el tope de tu categoría de monotributo." },
];

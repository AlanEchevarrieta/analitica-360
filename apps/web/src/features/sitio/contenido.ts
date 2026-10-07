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

/** Cuánto se ahorra en un año frente a pagar mes a mes. */
export function ahorroAnual(plan: PlanPagoId, ciclo: Ciclo): number {
  return (PRECIO_MENSUAL[plan] - precioPorMes(plan, ciclo)) * 12;
}

export const WHATSAPP = (process.env.NEXT_PUBLIC_WHATSAPP_CONTACT ?? "").replace(/\D/g, "");
export const linkWhatsApp = (texto = "Hola, quiero conocer Analítica 360") =>
  WHATSAPP ? `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(texto)}` : "/sign-up";

/** Las tres cosas grandes que hace el sistema, cada una con su maqueta. */
export const DESTACADAS = [
  {
    id: "operacion",
    etiqueta: "Operación diaria",
    titulo: "Vendé rápido y tené el stock siempre al día",
    texto: "Cada venta descuenta el stock, suma a la caja y calcula tu ganancia real. Desde la compu o el celular, con lector de códigos.",
    puntos: ["Efectivo, tarjeta, transferencia y cuotas con recargo", "Variantes de talle y color, en varios locales o depósitos", "Compras que actualizan el costo real con flete incluido"],
  },
  {
    id: "numeros",
    etiqueta: "Números claros",
    titulo: "Sabé cuánto ganás, no solo cuánto vendés",
    texto: "Ganancia por producto, punto de equilibrio y el tope de tu monotributo, sin planillas. También en dólares, con el valor de cada día.",
    puntos: ["Estado de resultados, libro diario y balance automáticos", "Pronósticos, combos y precio sugerido", "Informe por email cada semana, para vos o tu contador"],
  },
  {
    id: "online",
    etiqueta: "Ventas online",
    titulo: "Tu tienda online, conectada al mismo stock",
    texto: "Publicá tu catálogo con tu dominio. Los pedidos entran directo al sistema y nunca vendés algo que no tenés.",
    puntos: ["Ofertas, cupones y descuento por transferencia", "Cuentas de compradores con sus pedidos", "Subdominio gratis o tu propio dominio"],
  },
] as const;

/** El resto, en una grilla simple de íconos (clave de ícono en Sitio.tsx). */
export const EXTRAS = [
  { icono: "clientes", titulo: "Clientes y cuenta corriente", texto: "Quién te debe, cuánto y desde cuándo." },
  { icono: "precios", titulo: "Listas de precios", texto: "Mayorista, minorista o las que necesites." },
  { icono: "produccion", titulo: "Producción", texto: "Recetas, fabricación y kits con su costo." },
  { icono: "pedidos", titulo: "Pedidos y remitos", texto: "Preparación, despacho y remito impreso." },
  { icono: "whatsapp", titulo: "Difusiones por WhatsApp", texto: "Segmentá clientes y avisales novedades." },
  { icono: "excel", titulo: "Importar desde Excel", texto: "Traé tus productos y clientes en minutos." },
  { icono: "equipo", titulo: "Equipo con permisos", texto: "Cada persona ve y hace solo lo que corresponde." },
  { icono: "celular", titulo: "En el celular", texto: "Se instala como app, sin descargar nada." },
] as const;

/** Comparación de planes, agrupada. `funcion` sale del catálogo; `valores` es fijo por plan. */
export type FilaComparacion = { etiqueta: string; funcion?: string; limite?: "maxUsuarios" | "maxUbicaciones" };
export const COMPARACION: { grupo: string; filas: FilaComparacion[] }[] = [
  {
    grupo: "Ventas y stock",
    filas: [
      { etiqueta: "Ventas, productos y clientes", funcion: "ventas" },
      { etiqueta: "Compras, proveedores e inventario", funcion: "inventario" },
      { etiqueta: "Pedidos con preparación y remitos", funcion: "pedidos" },
      { etiqueta: "Producción: recetas, fabricación y kits", funcion: "produccion" },
      { etiqueta: "Importar desde Excel", funcion: "importar" },
    ],
  },
  {
    grupo: "Clientes",
    filas: [
      { etiqueta: "Listas de precios y cuenta corriente", funcion: "listas_precios" },
      { etiqueta: "Segmentos y difusiones por WhatsApp", funcion: "difusiones" },
    ],
  },
  {
    grupo: "Números y control",
    filas: [
      { etiqueta: "Informe semanal por email", funcion: "ventas" },
      { etiqueta: "Analytics y vista en dólares", funcion: "analytics" },
      { etiqueta: "Insights: pronósticos y combos", funcion: "insights" },
      { etiqueta: "Contabilidad y monotributo", funcion: "contabilidad" },
      { etiqueta: "Informe mensual por email", funcion: "informe_mensual" },
      { etiqueta: "Bitácora de auditoría", funcion: "auditoria" },
    ],
  },
  {
    grupo: "Ventas online",
    filas: [{ etiqueta: "Tienda online con ofertas, cupones y cuentas de compradores", funcion: "tienda" }],
  },
  {
    grupo: "Equipo y soporte",
    filas: [
      { etiqueta: "Usuarios", limite: "maxUsuarios" },
      { etiqueta: "Locales, depósitos o ferias", limite: "maxUbicaciones" },
      { etiqueta: "Soporte por WhatsApp", funcion: "ventas" },
    ],
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
  {
    p: "¿Sirve para mi rubro?",
    r: "Sí. Está pensado para cualquier negocio que compre, fabrique o venda productos, sea cual sea el rubro: comercios minoristas y mayoristas, distribuidoras, industrias y talleres que producen, emprendimientos y quienes venden por internet, en ferias o en varios locales. Si tenés dudas sobre tu caso, escribinos y lo vemos juntos.",
  },
  { p: "¿Puedo pasar mis datos desde Excel u otro sistema?", r: "Sí. Importás productos y clientes desde Excel, y si venís de otro sistema te ayudamos a pasar tu información." },
  { p: "¿Funciona en el celular?", r: "Sí. Funciona en el navegador de la compu, la tablet o el celular, y se puede instalar como una app. Para vender podés usar la cámara del celular como lector de códigos." },
  { p: "¿Mis datos están seguros?", r: "Hacemos copias de seguridad todos los días, la conexión va cifrada y cada cambio queda registrado en una bitácora que no se puede alterar. Los datos son tuyos: los exportás cuando quieras." },
  { p: "¿Cómo pago? ¿Hay cuotas?", r: `Pagás por mes, por trimestre (15 % menos) o por año (25 % menos). El anual se puede pagar en hasta ${CUOTAS_ANUAL} cuotas sin interés. Los precios son en pesos, más IVA.` },
  { p: "¿Puedo cambiar de plan o darme de baja?", r: "Sí, cuando quieras. Si te das de baja tenés 30 días para arrepentirte y descargar toda tu información." },
  { p: "¿Emite factura electrónica?", r: "La Factura C de ARCA está en camino. Mientras tanto, el sistema lleva el control de tu facturación contra el tope de tu categoría de monotributo." },
];

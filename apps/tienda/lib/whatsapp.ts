/** Link de WhatsApp del negocio (número argentino de 10 dígitos: se completa con 549). */
export function urlWhatsApp(numero: string | null | undefined, texto: string): string | null {
  const d = (numero ?? "").replace(/\D/g, "");
  if (d.length < 8) return null;
  const completo = d.length === 10 ? `549${d}` : d;
  return `https://wa.me/${completo}?text=${encodeURIComponent(texto)}`;
}

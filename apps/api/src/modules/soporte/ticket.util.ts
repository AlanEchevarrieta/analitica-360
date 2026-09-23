/** Puerto de formato_numero_ticket() (supabase/039_tickets_soporte.sql): 'T-' + el número, con cero-padding a un mínimo de 6 dígitos. */
export function formatoNumeroTicket(n: bigint): string {
  const s = n.toString();
  return `T-${s.padStart(Math.max(6, s.length), '0')}`;
}

/** Puerto de ticketConRespuestaAdminNoLeida (src/lib/tickets.ts): true si la última respuesta de un admin es más nueva que la última vez que el cliente vio el ticket. */
export function tieneRespuestaAdminNoLeida(vistoClienteAt: Date | null, respuestas: { esAdmin: boolean; createdAt: Date }[]): boolean {
  const admin = respuestas.filter((r) => r.esAdmin);
  if (admin.length === 0) return false;
  if (!vistoClienteAt) return true;
  const ultima = admin.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
  return ultima.createdAt > vistoClienteAt;
}

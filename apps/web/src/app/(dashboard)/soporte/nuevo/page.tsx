import { NuevoTicketForm } from "@/features/soporte/components/NuevoTicketForm";
import { PLANES, PLANES_PAGOS, type PlanPagoId } from "@/features/planes/planes";

export default async function Page(props: PageProps<"/soporte/nuevo">) {
  const { plan, ciclo } = await props.searchParams;
  // Desde Planes (sin WhatsApp configurado): el pedido de contratación llega ya escrito.
  const elegido = typeof plan === "string" && (PLANES_PAGOS as string[]).includes(plan) ? PLANES[plan as PlanPagoId].nombre : null;
  const inicial = elegido
    ? {
        asunto: `Quiero contratar el plan ${elegido}`,
        descripcion: `Hola, quiero contratar el plan ${elegido}${ciclo === "anual" ? " con pago anual" : " con pago mensual"}. ¿Cómo sigo con el pago?`,
        categoria: "facturacion" as const,
      }
    : undefined;
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{elegido ? "Contratar plan" : "Nuevo ticket"}</h1>
      <NuevoTicketForm inicial={inicial} />
    </div>
  );
}

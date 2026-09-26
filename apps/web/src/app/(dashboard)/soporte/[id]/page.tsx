import { TicketFichaVista } from "@/features/soporte/components/TicketFichaVista";

export default async function Page(props: PageProps<"/soporte/[id]">) {
  const { id } = await props.params;
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Ticket de soporte</h1>
      <TicketFichaVista id={id} />
    </div>
  );
}

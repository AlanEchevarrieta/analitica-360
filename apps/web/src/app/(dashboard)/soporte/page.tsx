import { TicketsListado } from "@/features/soporte/components/TicketsListado";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Soporte</h1>
      <TicketsListado />
    </div>
  );
}

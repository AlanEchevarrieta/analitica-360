import { VentasListado } from "@/features/ventas/components/VentasListado";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Ventas</h1>
      <VentasListado />
    </div>
  );
}

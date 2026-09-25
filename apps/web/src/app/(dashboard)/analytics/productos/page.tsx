import { GananciaProductos } from "@/features/analytics/components/GananciaProductos";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Ganancia por producto</h1>
      <GananciaProductos />
    </div>
  );
}

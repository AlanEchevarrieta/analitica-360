import { PestanasInventario } from "@/features/inventario/components/PestanasInventario";
import { StockListado } from "@/features/inventario/components/StockListado";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Inventario</h1>
        <PestanasInventario />
      </div>
      <StockListado />
    </div>
  );
}

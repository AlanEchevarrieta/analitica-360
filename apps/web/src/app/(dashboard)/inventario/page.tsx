import { StockListado } from "@/features/inventario/components/StockListado";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Inventario</h1>
      <StockListado />
    </div>
  );
}

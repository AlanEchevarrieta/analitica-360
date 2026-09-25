import { PedidosListado } from "@/features/pedidos/components/PedidosListado";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Pedidos</h1>
      <PedidosListado />
    </div>
  );
}

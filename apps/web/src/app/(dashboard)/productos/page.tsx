import { ProductosListado } from "@/features/productos/components/ProductosListado";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Productos</h1>
      <ProductosListado />
    </div>
  );
}

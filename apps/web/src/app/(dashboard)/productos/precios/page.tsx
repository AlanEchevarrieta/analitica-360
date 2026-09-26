import { PreciosMasivosVista } from "@/features/productos/components/PreciosMasivosVista";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Actualizar precios</h1>
        <p className="text-sm text-muted-foreground">Subí o bajá los precios de muchos productos a la vez.</p>
      </div>
      <PreciosMasivosVista />
    </div>
  );
}

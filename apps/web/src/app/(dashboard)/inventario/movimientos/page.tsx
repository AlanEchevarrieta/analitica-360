import { MovimientosVista } from "@/features/inventario/components/MovimientosVista";
import { PestanasInventario } from "@/features/inventario/components/PestanasInventario";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Movimientos de stock</h1>
          <p className="text-sm text-muted-foreground">Todo lo que entró, salió o se movió, de todos los productos. Tocá un producto para ver su kardex.</p>
        </div>
        <PestanasInventario />
      </div>
      <MovimientosVista />
    </div>
  );
}

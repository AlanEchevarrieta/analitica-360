import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { VentasListado } from "@/features/ventas/components/VentasListado";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Ventas</h1>
        <Link href="/ventas/nueva" className={buttonVariants()}>
          <Plus aria-hidden /> Nueva venta
        </Link>
      </div>
      <VentasListado />
    </div>
  );
}

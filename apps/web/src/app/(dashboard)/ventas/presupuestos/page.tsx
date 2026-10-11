import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PresupuestosListado } from "@/features/presupuestos/PresupuestosListado";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link href="/ventas" className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Volver a ventas">
            <ArrowLeft />
          </Link>
          <h1 className="text-xl font-semibold">Presupuestos</h1>
        </div>
        <Link href="/ventas/presupuestos/nuevo" className={buttonVariants()}>
          <Plus aria-hidden /> Nuevo presupuesto
        </Link>
      </div>
      <PresupuestosListado />
    </div>
  );
}

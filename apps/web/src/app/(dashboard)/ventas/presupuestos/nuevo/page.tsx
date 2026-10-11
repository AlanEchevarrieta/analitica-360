import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { NuevoPresupuesto } from "@/features/presupuestos/NuevoPresupuesto";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Link href="/ventas/presupuestos" className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Volver a presupuestos">
          <ArrowLeft />
        </Link>
        <h1 className="text-xl font-semibold">Nuevo presupuesto</h1>
      </div>
      <NuevoPresupuesto />
    </div>
  );
}

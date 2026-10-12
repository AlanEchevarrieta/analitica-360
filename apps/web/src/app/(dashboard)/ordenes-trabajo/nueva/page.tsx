import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { NuevaOrdenTrabajo } from "@/features/ordenes-trabajo/NuevaOrdenTrabajo";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Link href="/ordenes-trabajo" className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Volver a órdenes de trabajo">
          <ArrowLeft />
        </Link>
        <h1 className="text-xl font-semibold">Recibir un trabajo</h1>
      </div>
      <NuevaOrdenTrabajo />
    </div>
  );
}

import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { OrdenesTrabajoListado } from "@/features/ordenes-trabajo/OrdenesTrabajoListado";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Órdenes de trabajo</h1>
        <Link href="/ordenes-trabajo/nueva" className={buttonVariants()}>
          <Plus aria-hidden /> Recibir un trabajo
        </Link>
      </div>
      <OrdenesTrabajoListado />
    </div>
  );
}

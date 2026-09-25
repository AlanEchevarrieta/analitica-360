import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ClientesListado } from "@/features/clientes/components/ClientesListado";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Clientes</h1>
        <div className="flex gap-2">
          <Link href="/clientes/segmentos" className={buttonVariants({ variant: "outline" })}>
            Segmentos y difusiones
          </Link>
          <Link href="/clientes/nuevo" className={buttonVariants()}>
            <Plus aria-hidden /> Nuevo cliente
          </Link>
        </div>
      </div>
      <ClientesListado />
    </div>
  );
}

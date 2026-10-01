import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ProveedoresListado } from "@/features/proveedores/components/ProveedoresListado";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Proveedores</h1>
        <Link href="/proveedores/nuevo" className={buttonVariants()}>
          <Plus aria-hidden /> Nuevo proveedor
        </Link>
      </div>
      <ProveedoresListado />
    </div>
  );
}

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CuentaCorrienteVista } from "@/features/clientes/components/CuentaCorrienteVista";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/clientes" aria-label="Volver a clientes" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold">Cuenta corriente</h1>
          <p className="text-sm text-muted-foreground">Lo que te deben tus clientes (ventas a cuenta y saldos de señas).</p>
        </div>
      </div>
      <CuentaCorrienteVista />
    </div>
  );
}

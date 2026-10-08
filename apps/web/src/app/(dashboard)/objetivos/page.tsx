import type { Metadata } from "next";
import { ObjetivosVista } from "@/features/objetivos/components/ObjetivosVista";

export const metadata: Metadata = { title: "Objetivos" };

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Objetivos</h1>
        <p className="text-sm text-muted-foreground">Metas de facturación, ganancia, producción y despacho de pedidos, para toda la empresa, cada sucursal o cada usuario.</p>
      </div>
      <ObjetivosVista />
    </div>
  );
}

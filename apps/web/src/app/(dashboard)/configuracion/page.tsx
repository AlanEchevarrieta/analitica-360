import { Suspense } from "react";
import { ConfiguracionVista } from "@/features/configuracion/components/ConfiguracionVista";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Configuración</h1>
      <Suspense>
        <ConfiguracionVista />
      </Suspense>
    </div>
  );
}

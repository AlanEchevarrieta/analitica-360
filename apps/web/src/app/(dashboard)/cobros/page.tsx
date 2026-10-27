import { Suspense } from "react";
import { CobrosVista } from "@/features/cobros/components/CobrosVista";

export default function CobrosPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Cargando centro de cobros...</div>}>
      <CobrosVista />
    </Suspense>
  );
}

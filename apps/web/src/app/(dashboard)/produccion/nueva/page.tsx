import { Suspense } from "react";
import { NuevaOrden } from "@/features/produccion/NuevaOrden";

export default function Page() {
  return (
    <Suspense>
      <NuevaOrden />
    </Suspense>
  );
}

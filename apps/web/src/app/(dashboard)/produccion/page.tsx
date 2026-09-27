import { Suspense } from "react";
import { ProduccionVista } from "@/features/produccion/ProduccionVista";

export default function Page() {
  return (
    <Suspense>
      <ProduccionVista />
    </Suspense>
  );
}

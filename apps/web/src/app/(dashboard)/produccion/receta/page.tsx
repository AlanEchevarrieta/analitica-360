import { Suspense } from "react";
import { RecetaEditor } from "@/features/produccion/RecetaEditor";

export default function Page() {
  return (
    <Suspense>
      <RecetaEditor />
    </Suspense>
  );
}

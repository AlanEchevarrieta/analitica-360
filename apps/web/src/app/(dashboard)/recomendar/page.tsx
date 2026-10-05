import type { Metadata } from "next";
import { RecomendarVista } from "@/features/referidos/RecomendarVista";

export const metadata: Metadata = { title: "Recomendá y ganá" };

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Recomendá y ganá</h1>
        <p className="text-sm text-muted-foreground">Invitá a otros negocios: ellos empiezan con beneficios y vos pagás menos.</p>
      </div>
      <RecomendarVista />
    </div>
  );
}

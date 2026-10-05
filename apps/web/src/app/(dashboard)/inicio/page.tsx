import { InicioDashboard } from "@/features/dashboard/components/InicioDashboard";
import { PrimerosPasos } from "@/features/dashboard/components/PrimerosPasos";
import { SelectorMoneda } from "@/components/shared/selector-moneda";

export default async function Page(props: PageProps<"/inicio">) {
  const { bienvenida } = await props.searchParams;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Inicio</h1>
        <SelectorMoneda />
      </div>
      <PrimerosPasos bienvenida={bienvenida === "1"} />
      <InicioDashboard />
    </div>
  );
}

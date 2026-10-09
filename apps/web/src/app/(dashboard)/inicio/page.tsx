import { InicioDashboard } from "@/features/dashboard/components/InicioDashboard";
import { PrimerosPasos } from "@/features/dashboard/components/PrimerosPasos";
import { SelectorMoneda } from "@/components/shared/selector-moneda";
import { ObjetivosInicio } from "@/features/objetivos/components/ObjetivosInicio";
import { EquilibrioInicio } from "@/features/dashboard/components/EquilibrioInicio";

export default async function Page(props: PageProps<"/inicio">) {
  const { bienvenida } = await props.searchParams;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Inicio</h1>
        <SelectorMoneda />
      </div>
      <PrimerosPasos bienvenida={bienvenida === "1"} />
      <InicioDashboard
        debajoDeCifras={
          // Primero las ventas (lo que más se mira); después, en una sola fila, cuánto falta para no perder plata y cómo vienen los objetivos.
          <div className="grid items-stretch gap-4 lg:grid-cols-2 empty:hidden">
            <EquilibrioInicio />
            <ObjetivosInicio />
          </div>
        }
      />
    </div>
  );
}

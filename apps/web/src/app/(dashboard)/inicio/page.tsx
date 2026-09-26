import { InicioDashboard } from "@/features/dashboard/components/InicioDashboard";
import { PrimerosPasos } from "@/features/dashboard/components/PrimerosPasos";

export default async function Page(props: PageProps<"/inicio">) {
  const { bienvenida } = await props.searchParams;
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Inicio</h1>
      <PrimerosPasos bienvenida={bienvenida === "1"} />
      <InicioDashboard />
    </div>
  );
}

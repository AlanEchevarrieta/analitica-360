import { PresupuestoFicha } from "@/features/presupuestos/PresupuestoFicha";

export default async function Page(props: PageProps<"/ventas/presupuestos/[id]">) {
  const { id } = await props.params;
  return <PresupuestoFicha id={id} />;
}

import { OrdenTrabajoFicha } from "@/features/ordenes-trabajo/OrdenTrabajoFicha";

export default async function Page(props: PageProps<"/ordenes-trabajo/[id]">) {
  const { id } = await props.params;
  return <OrdenTrabajoFicha id={id} />;
}

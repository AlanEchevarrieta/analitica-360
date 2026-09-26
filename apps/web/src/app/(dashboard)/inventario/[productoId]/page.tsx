import { KardexVista } from "@/features/inventario/components/KardexVista";

export default async function Page(props: PageProps<"/inventario/[productoId]">) {
  const { productoId } = await props.params;
  return <KardexVista productoId={productoId} />;
}

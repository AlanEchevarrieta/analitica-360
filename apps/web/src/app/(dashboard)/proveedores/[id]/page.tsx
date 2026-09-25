import { ProveedorFichaVista } from "@/features/proveedores/components/ProveedorFichaVista";

export default async function Page(props: PageProps<"/proveedores/[id]">) {
  const { id } = await props.params;
  return <ProveedorFichaVista id={id} />;
}

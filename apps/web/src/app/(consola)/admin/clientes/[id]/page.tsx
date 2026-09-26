import { ClienteFichaVista } from "@/features/admin/components/ClienteFichaVista";

export default async function Page(props: PageProps<"/admin/clientes/[id]">) {
  const { id } = await props.params;
  return <ClienteFichaVista id={id} />;
}

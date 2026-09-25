import { ClienteFichaVista } from "@/features/clientes/components/ClienteFichaVista";

export default async function Page(props: PageProps<"/clientes/[id]">) {
  const { id } = await props.params;
  return <ClienteFichaVista id={id} />;
}

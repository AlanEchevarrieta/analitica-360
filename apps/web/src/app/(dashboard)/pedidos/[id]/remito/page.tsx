import { RemitoPedido } from "@/features/pedidos/components/RemitoPedido";

export default async function Page(props: PageProps<"/pedidos/[id]/remito">) {
  const { id } = await props.params;
  return <RemitoPedido id={id} />;
}

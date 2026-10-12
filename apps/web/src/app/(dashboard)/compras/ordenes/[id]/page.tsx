import { OrdenCompraFicha } from "@/features/ordenes-compra/components/OrdenCompraFicha";

export default async function Page(props: PageProps<"/compras/ordenes/[id]">) {
  const { id } = await props.params;
  return <OrdenCompraFicha id={id} />;
}

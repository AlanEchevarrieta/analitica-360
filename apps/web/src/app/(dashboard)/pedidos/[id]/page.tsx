import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PedidoFichaVista } from "@/features/pedidos/components/PedidoFicha";

export default async function Page(props: PageProps<"/pedidos/[id]">) {
  const { id } = await props.params;
  return (
    <div className="flex flex-col gap-4">
      <Link href="/pedidos" className={`${buttonVariants({ variant: "ghost", size: "sm" })} self-start`}>
        <ArrowLeft aria-hidden /> Pedidos
      </Link>
      <PedidoFichaVista id={id} />
    </div>
  );
}

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { VentaFichaVista } from "@/features/ventas/components/VentaFicha";

export default async function Page(props: PageProps<"/ventas/[id]">) {
  const { id } = await props.params;
  return (
    <div className="flex flex-col gap-4">
      <Link href="/ventas" className={`${buttonVariants({ variant: "ghost", size: "sm" })} self-start`}>
        <ArrowLeft aria-hidden /> Ventas
      </Link>
      <VentaFichaVista id={id} />
    </div>
  );
}

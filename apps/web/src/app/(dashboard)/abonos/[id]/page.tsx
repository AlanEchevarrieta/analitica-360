import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { AbonoFicha } from "@/features/abonos/AbonoFicha";

export default async function Page(props: PageProps<"/abonos/[id]">) {
  const { id } = await props.params;
  return (
    <div className="flex flex-col gap-4">
      <Link href="/abonos" className={buttonVariants({ variant: "ghost", className: "w-fit" })}>
        <ArrowLeft aria-hidden /> Abonos
      </Link>
      <AbonoFicha id={id} />
    </div>
  );
}

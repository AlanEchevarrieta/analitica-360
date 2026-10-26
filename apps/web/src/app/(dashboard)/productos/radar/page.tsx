import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { RadarPreciosVista } from "@/features/productos/components/RadarPreciosVista";

export default function RadarPreciosPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/productos" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Volver a Productos
        </Link>
      </div>
      <RadarPreciosVista />
    </div>
  );
}

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { AgendaConfig } from "@/features/agenda/AgendaConfig";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Link href="/agenda" className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Volver a la agenda">
          <ArrowLeft />
        </Link>
        <h1 className="text-xl font-semibold">Profesionales y horarios</h1>
      </div>
      <AgendaConfig />
    </div>
  );
}

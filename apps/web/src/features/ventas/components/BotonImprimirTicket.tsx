"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BotonImprimirTicket() {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => window.print()}
      className="w-full justify-center gap-2 print:hidden"
    >
      <Printer className="size-4" /> Imprimir comprobante
    </Button>
  );
}

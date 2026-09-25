import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatoNumero } from "@/lib/formato";

export function Paginacion({
  pagina,
  porPagina,
  total,
  onCambiar,
}: {
  pagina: number;
  porPagina: number;
  total: number;
  onCambiar: (pagina: number) => void;
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (total === 0) return null;
  return (
    <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
      <span>
        {formatoNumero(total)} en total · página {pagina} de {formatoNumero(paginas)}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => onCambiar(pagina - 1)}>
          <ChevronLeft aria-hidden /> Anterior
        </Button>
        <Button variant="outline" size="sm" disabled={pagina >= paginas} onClick={() => onCambiar(pagina + 1)}>
          Siguiente <ChevronRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}

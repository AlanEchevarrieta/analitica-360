import { AlertCircle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function CargandoFilas({ filas = 6 }: { filas?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: filas }, (_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

export function SinDatos({ mensaje }: { mensaje: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
      <Inbox className="size-8" aria-hidden />
      <p>{mensaje}</p>
    </div>
  );
}

export function ErrorDatos({ error, onReintentar }: { error: unknown; onReintentar?: () => void }) {
  const mensaje = error instanceof Error ? error.message : "No se pudieron cargar los datos.";
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center">
      <AlertCircle className="size-8 text-destructive" aria-hidden />
      <p className="text-sm">{mensaje}</p>
      {onReintentar && (
        <Button variant="outline" onClick={onReintentar}>
          Reintentar
        </Button>
      )}
    </div>
  );
}

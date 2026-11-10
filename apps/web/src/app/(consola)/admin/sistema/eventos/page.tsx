import { EventosSistemaPanel } from "@/features/admin/components/EventosSistemaPanel";

export default function EventosSistemaPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">Eventos del sistema</h1>
        <p className="text-sm text-muted-foreground">Cola de correos, avisos y automatizaciones con reintentos automáticos.</p>
      </div>
      <EventosSistemaPanel />
    </div>
  );
}

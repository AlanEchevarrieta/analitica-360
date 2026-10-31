import { Logo } from "@/features/sitio/components/Logo";

/**
 * Pantalla de carga global y mobile splash para Analítica 360.
 * Se muestra automáticamente en transiciones de ruta y carga inicial en Next.js.
 */
export default function Loading() {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-md transition-opacity duration-300"
      aria-busy="true"
      aria-label="Cargando Analítica 360"
    >
      <div className="flex flex-col items-center gap-5 text-center animate-in fade-in zoom-in-95 duration-300">
        <div className="relative flex items-center justify-center">
          {/* Resplandor orbital animado de fondo */}
          <div className="absolute -inset-3 rounded-full bg-gradient-to-tr from-cyan-500/20 to-sky-500/20 blur-xl animate-pulse" />
          <Logo conNombre={false} className="size-16 relative z-10 drop-shadow-md" />
        </div>
        
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-xl font-bold tracking-tight">
            <span className="text-cyan-500 dark:text-cyan-400">Analítica</span>{" "}
            <span className="text-sky-500 dark:text-sky-400">360</span>
          </span>
          <p className="text-xs text-muted-foreground animate-pulse">
            Iniciando plataforma...
          </p>
        </div>

        {/* Barra de progreso sutil con resplandor */}
        <div className="relative h-1 w-36 overflow-hidden rounded-full bg-muted/60 mt-2">
          <div className="h-full w-full bg-gradient-to-r from-cyan-400 via-teal-400 to-sky-500 rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  );
}

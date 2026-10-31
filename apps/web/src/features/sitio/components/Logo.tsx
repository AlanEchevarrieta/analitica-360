import { cn } from "@/lib/utils";

/** Logo oficial de Analítica 360: Isotipo 'A' con anillo orbital 360° en gradiente cian-azul */
export function Logo({ className, conNombre = true }: { className?: string; conNombre?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 font-semibold tracking-tight select-none", className)}>
      <svg
        viewBox="0 0 120 120"
        className="size-8 shrink-0 drop-shadow-sm"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="a360-ring" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00e5c9" />
            <stop offset="60%" stopColor="#00d2b4" />
            <stop offset="85%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
          <linearGradient id="a360-apex" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00e5c9" />
            <stop offset="100%" stopColor="#00d2b4" />
          </linearGradient>
          <linearGradient id="a360-leg-left" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#00e5c9" />
            <stop offset="100%" stopColor="#00b4d8" />
          </linearGradient>
          <linearGradient id="a360-leg-right" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00d2b4" />
            <stop offset="60%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
        </defs>

        {/* 1. Arco posterior del anillo 360 (pasa detrás del vértice de la 'A') */}
        <path
          d="M 20,54 A 42 14.5 0 0 1 100,54"
          stroke="url(#a360-ring)"
          strokeWidth="11.5"
          strokeLinecap="round"
        />

        {/* 2. Vértice superior de la 'A' */}
        <path
          d="M 43,51 L 60,18 C 60.5,17 61.5,17 62,18 L 79,51"
          stroke="url(#a360-apex)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* 3. Pata izquierda de la 'A' */}
        <path
          d="M 42,56 L 31,84"
          stroke="url(#a360-leg-left)"
          strokeWidth="12"
          strokeLinecap="round"
        />

        {/* 4. Pata derecha de la 'A' */}
        <path
          d="M 78,56 L 89,84"
          stroke="url(#a360-leg-right)"
          strokeWidth="12"
          strokeLinecap="round"
        />

        {/* 5. Arco frontal del anillo 360 (pasa por delante de las patas) */}
        <path
          d="M 20,54 A 42 14.5 0 0 0 100,54"
          stroke="url(#a360-ring)"
          strokeWidth="11.5"
          strokeLinecap="round"
        />
      </svg>
      {conNombre && (
        <span className="text-lg font-semibold tracking-tight flex items-center gap-1">
          <span className="text-cyan-500 dark:text-cyan-400">Analítica</span>
          <span className="text-sky-500 dark:text-sky-400">360</span>
        </span>
      )}
    </span>
  );
}

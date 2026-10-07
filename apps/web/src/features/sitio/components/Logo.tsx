import { cn } from "@/lib/utils";

/** Marca: anillo "360" con una barra de crecimiento + nombre. */
export function Logo({ className, conNombre = true }: { className?: string; conNombre?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
        <defs>
          <linearGradient id="logo-a360" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6366f1" />
            <stop offset="1" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill="url(#logo-a360)" />
        <circle cx="16" cy="16" r="9" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="2.5" />
        <path d="M16 7a9 9 0 0 1 8.6 6.3" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
        <rect x="11" y="16" width="2.6" height="5" rx="1" fill="#fff" />
        <rect x="14.7" y="13.5" width="2.6" height="7.5" rx="1" fill="#fff" />
        <rect x="18.4" y="11" width="2.6" height="10" rx="1" fill="#fff" />
      </svg>
      {conNombre && <span className="text-lg">Analítica 360</span>}
    </span>
  );
}

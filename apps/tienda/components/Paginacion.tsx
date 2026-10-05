import Link from "next/link";
import { paginasVisibles, urlConsulta, type Consulta } from "@/lib/catalogo";

/** Páginas numeradas: ‹ 1 … 4 5 6 … 10 › (son links: se pueden abrir en otra pestaña). */
export function Paginacion({ consulta, pagina, paginas }: { consulta: Consulta; pagina: number; paginas: number }) {
  if (paginas <= 1) return null;
  const link = (n: number) => urlConsulta(consulta, { pag: n });
  const flecha = "flex h-10 min-w-10 items-center justify-center rounded-[var(--r-boton)] px-3 text-sm font-medium transition";
  return (
    <nav aria-label="Páginas" className="mt-12 flex items-center justify-center gap-1">
      {pagina > 1 ? (
        <Link href={link(pagina - 1)} className={`${flecha} hover:bg-[var(--marca-oscuro)]/10`} rel="prev" aria-label="Página anterior">
          ‹<span className="hidden sm:inline">&nbsp;Anterior</span>
        </Link>
      ) : (
        <span className={`${flecha} text-[var(--tinta)]/30`}>
          ‹<span className="hidden sm:inline">&nbsp;Anterior</span>
        </span>
      )}
      <ol className="flex items-center gap-1">
        {paginasVisibles(pagina, paginas).map((n, i) =>
          n === "…" ? (
            <li key={`e${i}`} className="px-2 text-[var(--tinta)]/40" aria-hidden>
              …
            </li>
          ) : (
            <li key={n}>
              <Link
                href={link(n)}
                aria-current={n === pagina ? "page" : undefined}
                className={`flex size-10 items-center justify-center rounded-full text-sm tabular-nums transition ${
                  n === pagina ? "bg-[var(--marca-oscuro)] font-semibold text-white" : "text-[var(--tinta)]/75 hover:bg-[var(--marca-oscuro)]/10"
                }`}
              >
                {n}
              </Link>
            </li>
          ),
        )}
      </ol>
      {pagina < paginas ? (
        <Link href={link(pagina + 1)} className={`${flecha} hover:bg-[var(--marca-oscuro)]/10`} rel="next" aria-label="Página siguiente">
          <span className="hidden sm:inline">Siguiente&nbsp;</span>›
        </Link>
      ) : (
        <span className={`${flecha} text-[var(--tinta)]/30`}>
          <span className="hidden sm:inline">Siguiente&nbsp;</span>›
        </span>
      )}
    </nav>
  );
}

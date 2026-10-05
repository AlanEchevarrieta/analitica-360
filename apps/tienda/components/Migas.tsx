import Link from "next/link";

/** Camino de navegación: Inicio › Productos › Mates › Mate Imperial (el último no es link). */
export function Migas({ pasos }: { pasos: { label: string; href?: string }[] }) {
  const todos = [{ label: "Inicio", href: "/" }, ...pasos];
  return (
    <nav aria-label="Ruta" className="text-sm text-[var(--tinta)]/55">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {todos.map((p, i) => (
          <li key={`${p.label}-${i}`} className="flex items-center gap-2">
            {i > 0 ? <span aria-hidden>›</span> : null}
            {p.href && i < todos.length - 1 ? (
              <Link href={p.href} className="hover:text-[var(--marca)]">
                {p.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-[var(--tinta)]/80">
                {p.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

import { formatoARS } from "@/lib/productos";

/** Precio con la oferta: el de lista tachado y el % al lado. Sin oferta, solo el precio. */
export function Precio({ precio, precioLista, className = "" }: { precio: number; precioLista: number; className?: string }) {
  const pct = precioLista > precio ? Math.round((1 - precio / precioLista) * 100) : 0;
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-2 tabular-nums ${className}`}>
      {pct > 0 ? (
        <>
          <span className="sr-only">Antes</span>
          <s className="text-[0.8em] font-normal text-[var(--tinta)]/45">{formatoARS(precioLista)}</s>
          <span className="sr-only">ahora</span>
        </>
      ) : null}
      <span className="text-[var(--marca)]">{formatoARS(precio)}</span>
      {pct > 0 ? <span className="rounded-full bg-[var(--marca)] px-2 py-0.5 text-[0.65em] font-semibold text-white">−{pct}%</span> : null}
    </span>
  );
}

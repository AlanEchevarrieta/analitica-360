"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { alternarFavorito } from "@/app/cuenta/actions";

type Contexto = { conSesion: boolean; ids: Set<string>; alternar: (productoId: string) => void };
const Favoritos = createContext<Contexto>({ conSesion: false, ids: new Set(), alternar: () => {} });

/** Favoritos de la cuenta: se marcan al instante y se confirman con el servidor. */
export function FavoritosProvider({ conSesion, iniciales, children }: { conSesion: boolean; iniciales: string[]; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ids, setIds] = useState(() => new Set(iniciales));
  const [, startTransition] = useTransition();

  const alternar = (productoId: string) => {
    if (!conSesion) {
      router.push(`/ingresar?volver=${encodeURIComponent(pathname)}&motivo=favoritos`);
      return;
    }
    const marcar = !ids.has(productoId);
    setIds((v) => {
      const n = new Set(v);
      if (marcar) n.add(productoId);
      else n.delete(productoId);
      return n;
    });
    startTransition(async () => {
      const r = await alternarFavorito(productoId, marcar);
      if (r === null) router.push(`/ingresar?volver=${encodeURIComponent(pathname)}&motivo=favoritos`);
      else setIds(new Set(r));
    });
  };

  return <Favoritos.Provider value={{ conSesion, ids, alternar }}>{children}</Favoritos.Provider>;
}

export const useFavoritos = () => useContext(Favoritos);

export function BotonFavorito({ productoId, nombre, className = "" }: { productoId: string; nombre: string; className?: string }) {
  const { ids, alternar } = useFavoritos();
  const activo = ids.has(productoId);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        alternar(productoId);
      }}
      aria-pressed={activo}
      aria-label={activo ? `Quitar ${nombre} de favoritos` : `Guardar ${nombre} en favoritos`}
      className={`grid size-9 place-items-center rounded-full bg-white/90 shadow-sm transition hover:text-[var(--marca)] ${activo ? "text-[var(--marca)]" : "text-[var(--tinta)]/60"} ${className}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill={activo ? "currentColor" : "none"}>
        <path d="M12 20s-7-4.4-9-9a4.6 4.6 0 0 1 8-4.2L12 8l1-1.2A4.6 4.6 0 0 1 21 11c-2 4.6-9 9-9 9Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

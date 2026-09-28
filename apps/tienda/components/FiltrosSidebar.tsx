"use client";

import { formatoARS, type CategoriaId, type CategoriaTienda } from "@/lib/productos";

export type Filtros = {
  categoria: CategoriaId | "todos";
  precioMin: number;
  precioMax: number;
  soloStock: boolean;
};

export function FiltrosSidebar({
  filtros,
  onChange,
  bounds,
  categorias,
  onClose,
}: {
  categorias: CategoriaTienda[];
  filtros: Filtros;
  onChange: (next: Filtros) => void;
  bounds: { min: number; max: number };
  onClose?: () => void;
}) {
  return (
    <aside className="space-y-6">
      {onClose ? (
        <div className="flex items-center justify-between md:hidden">
          <h2 className="font-serif text-lg">Filtros</h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-[var(--marca-oscuro)]/10">
            ✕
          </button>
        </div>
      ) : (
        <h2 className="hidden font-serif text-lg md:block">Filtros</h2>
      )}

      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--tinta)]/60">Categoría</p>
        <div className="flex flex-col gap-1">
          <FiltroBoton activo={filtros.categoria === "todos"} onClick={() => onChange({ ...filtros, categoria: "todos" })}>
            Todos
          </FiltroBoton>
          {categorias.map((c) => (
            <FiltroBoton
              key={c.id}
              activo={filtros.categoria === c.id}
              onClick={() => onChange({ ...filtros, categoria: c.id })}
            >
              {c.label} <span className="text-[var(--tinta)]/50">({c.cantidad})</span>
            </FiltroBoton>
          ))}
        </div>
      </section>

      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--tinta)]/60">Precio</p>
        <div className="space-y-2">
          <label className="block text-sm">
            Desde {formatoARS(filtros.precioMin)}
            <input
              type="range"
              min={bounds.min}
              max={bounds.max}
              value={filtros.precioMin}
              onChange={(e) =>
                onChange({
                  ...filtros,
                  precioMin: Math.min(Number(e.target.value), filtros.precioMax),
                })
              }
              className="mt-1 w-full accent-[var(--marca-hero)]"
            />
          </label>
          <label className="block text-sm">
            Hasta {formatoARS(filtros.precioMax)}
            <input
              type="range"
              min={bounds.min}
              max={bounds.max}
              value={filtros.precioMax}
              onChange={(e) =>
                onChange({
                  ...filtros,
                  precioMax: Math.max(Number(e.target.value), filtros.precioMin),
                })
              }
              className="mt-1 w-full accent-[var(--marca-hero)]"
            />
          </label>
        </div>
      </section>

      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--tinta)]/60">Disponibilidad</p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filtros.soloStock}
            onChange={(e) => onChange({ ...filtros, soloStock: e.target.checked })}
            className="accent-[var(--marca-hero)]"
          />
          En stock
        </label>
        <p className="mt-1 text-xs text-[var(--tinta)]/50">Desmarcá para ver todos</p>
      </section>
    </aside>
  );
}

function FiltroBoton({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-left text-sm ${
        activo ? "bg-[var(--marca-hero)] text-white" : "hover:bg-[var(--marca-oscuro)]/10"
      }`}
    >
      {children}
    </button>
  );
}

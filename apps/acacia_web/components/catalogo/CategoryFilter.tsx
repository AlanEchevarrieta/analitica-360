"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface CategoryFilterProps {
  categorias: { id: string; label: string; count: number }[];
}

export function CategoryFilter({ categorias }: CategoryFilterProps) {
  const searchParams = useSearchParams();
  const catActual = searchParams.get("categoria") || "todos";

  return (
    <div className="flex flex-wrap gap-2 sm:gap-3 py-6 border-b border-[#1C1D1F]/10 font-mono-spec text-[11px] uppercase tracking-wider">
      <Link
        href="/catalogo"
        className={`px-4 py-2 border transition-colors ${
          catActual === "todos"
            ? "bg-[#1C1D1F] text-[#F7F6F2] border-[#1C1D1F]"
            : "border-[#1C1D1F]/20 text-[#1C1D1F] hover:border-[#1C1D1F]"
        }`}
      >
        Todos
      </Link>
      {categorias.map((cat) => {
        const activa = catActual === cat.id;
        return (
          <Link
            key={cat.id}
            href={`/catalogo?categoria=${cat.id}`}
            className={`px-4 py-2 border transition-colors ${
              activa
                ? "bg-[#1C1D1F] text-[#F7F6F2] border-[#1C1D1F]"
                : "border-[#1C1D1F]/20 text-[#1C1D1F] hover:border-[#1C1D1F]"
            }`}
          >
            {cat.label} ({cat.count})
          </Link>
        );
      })}
    </div>
  );
}

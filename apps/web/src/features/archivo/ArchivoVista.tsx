"use client";

import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { useRol } from "@/hooks/use-rol";
import { ListaDocumentos } from "./ListaDocumentos";
import { SubirDocumento } from "./SubirDocumento";
import { CATEGORIAS, tamanoLegible, useArchivo, useUsoArchivo } from "./use-archivo";

/** Documentos: todo el archivo del negocio, con búsqueda, filtro por tipo y el espacio usado. */
export function ArchivoVista() {
  const esDueno = useRol() === "dueno";
  const [categoria, setCategoria] = useState("");
  const [q, setQ] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const lista = useArchivo({ categoria: categoria || undefined, q: q.trim() || undefined });
  const uso = useUsoArchivo();
  const pct = uso.data ? Math.min(100, (uso.data.usado / uso.data.limite) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Documentos</h1>
          <p className="text-sm text-muted-foreground">Facturas de proveedores, contratos, habilitaciones, seguros y constancias, con aviso antes de que venzan. Solo los ven el dueño y el contador.</p>
        </div>
        {esDueno && !subiendo && (
          <Button onClick={() => setSubiendo(true)}>
            <Plus aria-hidden /> Subir documento
          </Button>
        )}
      </div>

      {subiendo && <SubirDocumento onListo={() => setSubiendo(false)} />}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute top-2 left-2.5 size-4 text-muted-foreground" aria-hidden />
          <Input className="pl-8" placeholder="Buscar por título, archivo o nota" aria-label="Buscar documentos" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="h-9 rounded-lg border bg-transparent px-2 text-sm" aria-label="Filtrar por tipo" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="">Todos los tipos</option>
          {CATEGORIAS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>

      <Card>
        <CardContent className="pt-2">
          {lista.isPending ? (
            <CargandoFilas />
          ) : lista.isError ? (
            <ErrorDatos error={lista.error} onReintentar={() => lista.refetch()} />
          ) : lista.data.length === 0 ? (
            <SinDatos mensaje={q || categoria ? "No hay documentos con ese filtro." : "Todavía no guardaste documentos. Subí el primero: por ejemplo, la habilitación del local o el contrato de alquiler."} />
          ) : (
            <ListaDocumentos documentos={lista.data} mostrarEntidad />
          )}
        </CardContent>
      </Card>

      {uso.data && (
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <div className="h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Espacio usado">
            <div className={pct > 90 ? "h-full bg-red-500" : "h-full bg-primary"} style={{ width: `${Math.max(pct, uso.data.usado ? 1 : 0)}%` }} />
          </div>
          <span>
            {uso.data.cantidad} {uso.data.cantidad === 1 ? "documento" : "documentos"} · {tamanoLegible(uso.data.usado)} de {tamanoLegible(uso.data.limite)}
          </span>
        </div>
      )}
    </div>
  );
}

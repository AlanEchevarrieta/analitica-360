"use client";

import { useState } from "react";
import { FolderOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CargandoFilas } from "@/components/shared/estado-datos";
import { usePlan } from "@/hooks/use-plan";
import { useRol } from "@/hooks/use-rol";
import { ListaDocumentos } from "./ListaDocumentos";
import { SubirDocumento } from "./SubirDocumento";
import { useArchivo, type CategoriaArchivo, type EntidadArchivo } from "./use-archivo";

/**
 * Documentos pegados a un proveedor o cliente (en su ficha). Solo para el dueño y el
 * contador, y en planes con archivo: para el resto no se muestra nada.
 */
export function DocumentosAdjuntos({ entidadTipo, entidadId, categoriaInicial }: { entidadTipo: Exclude<EntidadArchivo, "empresa">; entidadId: string; categoriaInicial?: CategoriaArchivo }) {
  const rol = useRol();
  const plan = usePlan();
  const habilitado = (rol === "dueno" || rol === "contador") && plan.disponible("archivo");
  const { data, isPending } = useArchivo({ entidadTipo, entidadId }, habilitado);
  const [subiendo, setSubiendo] = useState(false);
  if (!habilitado) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="size-4" /> Documentos
        </CardTitle>
        {rol === "dueno" && !subiendo && (
          <Button size="sm" variant="outline" onClick={() => setSubiendo(true)}>
            <Plus aria-hidden /> Subir
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {subiendo && <SubirDocumento entidadTipo={entidadTipo} entidadId={entidadId} categoriaInicial={categoriaInicial} onListo={() => setSubiendo(false)} />}
        {isPending ? (
          <CargandoFilas filas={2} />
        ) : data && data.length > 0 ? (
          <ListaDocumentos documentos={data} />
        ) : (
          !subiendo && <p className="text-sm text-muted-foreground">Sin documentos. Guardá acá facturas, contratos o constancias{entidadTipo === "proveedor" ? " de este proveedor" : " de este cliente"}.</p>
        )}
      </CardContent>
    </Card>
  );
}

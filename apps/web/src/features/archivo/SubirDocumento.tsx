"use client";

import { useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORIAS, useAccionesArchivo, type CategoriaArchivo, type EntidadArchivo } from "./use-archivo";

const selectCls = "h-8 rounded-lg border bg-transparent px-2 text-sm";
const ACEPTA = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx";

/** Subir un documento: archivo, título, tipo, vencimiento (opcional) y notas. */
export function SubirDocumento({
  entidadTipo = "empresa",
  entidadId = null,
  categoriaInicial = "otro",
  onListo,
}: {
  entidadTipo?: EntidadArchivo;
  entidadId?: string | null;
  categoriaInicial?: CategoriaArchivo;
  onListo?: () => void;
}) {
  const { subir } = useAccionesArchivo();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [titulo, setTitulo] = useState("");
  const [categoria, setCategoria] = useState<CategoriaArchivo>(categoriaInicial);
  const [vence, setVence] = useState("");
  const [notas, setNotas] = useState("");

  const guardar = () => {
    if (!archivo) return toast.error("Elegí el archivo");
    if (archivo.size > 20 * 1024 * 1024) return toast.error("El archivo pesa más de 20 MB");
    subir.mutate(
      { archivo, titulo: titulo.trim() || undefined, categoria, entidadTipo, entidadId, vence: vence || null, notas: notas.trim() || null },
      {
        onSuccess: (d) => {
          toast.success(`"${d.titulo}" guardado`);
          setArchivo(null);
          setTitulo("");
          setVence("");
          setNotas("");
          onListo?.();
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo subir"),
      },
    );
  };

  return (
    <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="doc-archivo">Archivo (PDF, foto, Word o Excel, hasta 20 MB)</Label>
        <input
          id="doc-archivo"
          type="file"
          accept={ACEPTA}
          className="text-sm file:mr-3 file:rounded-md file:border file:bg-transparent file:px-3 file:py-1 file:text-sm"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setArchivo(f);
            if (f && !titulo) setTitulo(f.name.replace(/\.[^.]+$/, ""));
          }}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="doc-titulo">Título</Label>
        <Input id="doc-titulo" maxLength={160} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej. Habilitación municipal 2026" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="doc-categoria">Tipo</Label>
        <select id="doc-categoria" className={selectCls} value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaArchivo)}>
          {CATEGORIAS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="doc-vence">Vence (opcional)</Label>
        <Input id="doc-vence" type="date" value={vence} onChange={(e) => setVence(e.target.value)} />
        <span className="text-xs text-muted-foreground">Te avisamos por email 30 y 7 días antes.</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="doc-notas">Notas</Label>
        <Input id="doc-notas" maxLength={1000} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej. Renovar en la municipalidad" />
      </div>
      <div className="flex justify-end sm:col-span-2">
        <Button onClick={guardar} disabled={subir.isPending || !archivo}>
          {subir.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
          Guardar documento
        </Button>
      </div>
    </div>
  );
}

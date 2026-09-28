"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { ImagePlus, Loader2, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiFetch } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

interface Foto {
  id: string;
  url: string;
  orden: number;
}
const MAXIMO = 8;

/** Fotos del producto para la tienda online: la primera es la principal. */
export function FotosProducto({ productoId }: { productoId: string }) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(0);
  const clave = ["fotos-producto", orgId, productoId];
  const fotos = useQuery({ queryKey: clave, queryFn: () => api<Foto[]>(`/productos/${productoId}/fotos`), enabled: Boolean(orgId) });
  const actualizar = (lista: Foto[]) => queryClient.setQueryData(clave, lista);
  const error = (e: unknown) => toast.error(e instanceof Error ? e.message : "No se pudo guardar la foto");
  const borrar = useMutation({ mutationFn: (id: string) => api<Foto[]>(`/productos/${productoId}/fotos/${id}`, { method: "DELETE" }), onSuccess: actualizar, onError: error });
  const principal = useMutation({
    mutationFn: (id: string) => api<Foto[]>(`/productos/${productoId}/fotos/orden`, { method: "PUT", body: JSON.stringify({ ids: [id, ...(fotos.data ?? []).map((f) => f.id).filter((x) => x !== id)] }) }),
    onSuccess: actualizar,
    onError: error,
  });

  async function subir(archivos: FileList | null) {
    if (!archivos?.length) return;
    const lista = [...archivos].slice(0, MAXIMO - (fotos.data?.length ?? 0));
    for (const archivo of lista) {
      if (archivo.size > 15 * 1024 * 1024) {
        toast.error(`${archivo.name} pesa más de 15 MB`);
        continue;
      }
      setSubiendo((n) => n + 1);
      try {
        const cuerpo = new FormData();
        cuerpo.append("archivo", archivo);
        actualizar(await api<Foto[]>(`/productos/${productoId}/fotos`, { method: "POST", body: cuerpo }));
      } catch (e) {
        error(e);
      } finally {
        setSubiendo((n) => n - 1);
      }
    }
    if (input.current) input.current.value = "";
  }

  const cantidad = fotos.data?.length ?? 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fotos</CardTitle>
        <CardDescription>Para la tienda online. La primera es la principal. JPG, PNG o WEBP de hasta 15 MB, directo del celular: se achican solas (hasta {MAXIMO}).</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {(fotos.data ?? []).map((f, i) => (
            <figure key={f.id} className={cn("group relative aspect-square overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10", i === 0 && "ring-2 ring-primary")}>
              {/* eslint-disable-next-line @next/next/no-img-element -- fotos subidas por el usuario, de otro origen */}
              <img src={f.url} alt={`Foto ${i + 1}`} className="size-full object-cover" />
              {i === 0 && <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">Principal</span>}
              <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/60 p-1">
                {i > 0 && (
                  <Button size="icon-sm" variant="secondary" aria-label={`Usar la foto ${i + 1} como principal`} onClick={() => principal.mutate(f.id)}>
                    <Star />
                  </Button>
                )}
                <Button size="icon-sm" variant="secondary" aria-label={`Borrar la foto ${i + 1}`} onClick={() => window.confirm("¿Borrar esta foto?") && borrar.mutate(f.id)}>
                  <Trash2 />
                </Button>
              </div>
            </figure>
          ))}
          {cantidad < MAXIMO && (
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={subiendo > 0}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-sm text-muted-foreground hover:bg-muted"
            >
              {subiendo > 0 ? <Loader2 className="size-6 animate-spin" aria-hidden /> : <ImagePlus className="size-6" aria-hidden />}
              {subiendo > 0 ? "Subiendo…" : "Subir foto"}
            </button>
          )}
        </div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" aria-label="Elegir fotos del producto" onChange={(e) => void subir(e.target.files)} />
      </CardContent>
    </Card>
  );
}

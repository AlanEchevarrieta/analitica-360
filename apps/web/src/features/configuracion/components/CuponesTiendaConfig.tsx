"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CargandoFilas, ErrorDatos } from "@/components/shared/estado-datos";
import { useApiFetch } from "@/hooks/use-api";
import { useRol } from "@/hooks/use-rol";
import { formatoPesos } from "@/lib/formato";
import { cn } from "@/lib/utils";

// Espejo de GET /tienda-config/cupones (apps/api modules/tienda/descuentos-admin.ts).
interface Cupon {
  id: string;
  codigo: string;
  tipo: "porcentaje" | "monto";
  valor: number;
  compraMinima: number | null;
  desde: string | null;
  hasta: string | null;
  usosMax: number | null;
  usos: number;
  activo: boolean;
  estado: "vigente" | "programado" | "vencido" | "agotado" | "inactivo";
  descontado: number;
}

const COLOR_ESTADO: Record<Cupon["estado"], string> = {
  vigente: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  programado: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  vencido: "bg-muted text-muted-foreground",
  agotado: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  inactivo: "bg-muted text-muted-foreground",
};
const fechaCorta = (f: string) => f.split("-").reverse().join("/");
const VACIO = { codigo: "", tipo: "porcentaje" as Cupon["tipo"], valor: "", compraMinima: "", desde: "", hasta: "", usosMax: "" };

/** Configuración → Cupones de la tienda: códigos de descuento para el checkout. */
export function CuponesTiendaConfig() {
  const api = useApiFetch();
  const { orgId } = useAuth();
  const esDueno = useRol() === "dueno";
  const queryClient = useQueryClient();
  const clave = ["cupones-tienda", orgId];
  const lista = useQuery({ queryKey: clave, queryFn: () => api<Cupon[]>("/tienda-config/cupones"), enabled: Boolean(orgId) });
  const [form, setForm] = useState<typeof VACIO | null>(null);
  const actualizar = (l: Cupon[]) => queryClient.setQueryData(clave, l);
  const error = (e: unknown) => toast.error(e instanceof Error ? e.message : "No se pudo guardar el cupón");
  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  const crear = useMutation({
    mutationFn: (f: typeof VACIO) =>
      api<Cupon[]>("/tienda-config/cupones", {
        method: "POST",
        body: JSON.stringify({ codigo: f.codigo, tipo: f.tipo, valor: Number(f.valor), compraMinima: num(f.compraMinima), desde: f.desde || null, hasta: f.hasta || null, usosMax: num(f.usosMax) }),
      }),
    onSuccess: (l) => {
      actualizar(l);
      setForm(null);
      toast.success("Cupón creado");
    },
    onError: error,
  });
  const activar = useMutation({
    mutationFn: (c: Cupon) => api<Cupon[]>(`/tienda-config/cupones/${c.id}`, { method: "PATCH", body: JSON.stringify({ activo: !c.activo }) }),
    onSuccess: actualizar,
    onError: error,
  });

  if (lista.isPending) return <CargandoFilas filas={4} />;
  if (lista.isError) return <ErrorDatos error={lista.error} onReintentar={() => lista.refetch()} />;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        El cliente escribe el código en el checkout de la tienda online. Podés limitar cuántas veces se usa, desde qué monto vale y hasta cuándo. Para que deje de valer, desactivalo: los cupones no se
        borran, así queda el historial.
      </p>

      {esDueno && !form && (
        <Button className="w-fit" onClick={() => setForm(VACIO)}>
          <Plus aria-hidden /> Nuevo cupón
        </Button>
      )}

      {form && (
        <form
          className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            crear.mutate(form);
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cupon-codigo">Código</Label>
            <Input id="cupon-codigo" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase().replace(/\s/g, "") })} placeholder="ACACIA10" autoFocus maxLength={40} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cupon-valor">Descuento</Label>
            <div className="flex gap-1.5">
              <Input id="cupon-valor" inputMode="decimal" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value.replace(/[^\d.]/g, "") })} />
              <select aria-label="Tipo de descuento" className="h-9 rounded-lg border bg-transparent px-2 text-sm" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as Cupon["tipo"] })}>
                <option value="porcentaje">%</option>
                <option value="monto">$</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cupon-minimo">Compra mínima (opcional)</Label>
            <Input id="cupon-minimo" inputMode="numeric" value={form.compraMinima} onChange={(e) => setForm({ ...form, compraMinima: e.target.value.replace(/\D/g, "") })} placeholder="Sin mínimo" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cupon-usos">Usos máximos (opcional)</Label>
            <Input id="cupon-usos" inputMode="numeric" value={form.usosMax} onChange={(e) => setForm({ ...form, usosMax: e.target.value.replace(/\D/g, "") })} placeholder="Sin límite" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cupon-desde">Desde (opcional)</Label>
            <Input id="cupon-desde" type="date" value={form.desde} onChange={(e) => setForm({ ...form, desde: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cupon-hasta">Hasta (opcional)</Label>
            <Input id="cupon-hasta" type="date" value={form.hasta} onChange={(e) => setForm({ ...form, hasta: e.target.value })} />
          </div>
          <div className="flex items-end gap-2 sm:col-span-2">
            <Button type="submit" disabled={crear.isPending || form.codigo.length < 3 || !(Number(form.valor) > 0)}>
              {crear.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null} Crear cupón
            </Button>
            <Button type="button" variant="ghost" onClick={() => setForm(null)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {lista.data.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Todavía no hay cupones.</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border">
          {lista.data.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3">
              <span className="font-mono font-semibold">{c.codigo}</span>
              <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-medium", COLOR_ESTADO[c.estado])}>{c.estado}</span>
              <span className="text-sm">{c.tipo === "porcentaje" ? `${c.valor}% off` : `${formatoPesos(c.valor)} off`}</span>
              <span className="text-xs text-muted-foreground">
                {[
                  c.compraMinima ? `desde ${formatoPesos(c.compraMinima)}` : null,
                  c.desde ? `del ${fechaCorta(c.desde)}` : null,
                  c.hasta ? `al ${fechaCorta(c.hasta)}` : null,
                  `${c.usos}${c.usosMax != null ? `/${c.usosMax}` : ""} usos`,
                  c.descontado ? `descontó ${formatoPesos(c.descontado)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              {esDueno && (
                <Button variant="ghost" size="sm" className="ml-auto" onClick={() => activar.mutate(c)} disabled={activar.isPending}>
                  {c.activo ? "Desactivar" : "Activar"}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

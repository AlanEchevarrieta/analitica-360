"use client";

import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { InputPlata } from "@/components/shared/input-plata";
import { useRol } from "@/hooks/use-rol";
import { formatoPesos } from "@/lib/formato";
import { aNumero } from "@/lib/numeros";
import { detallePlan, useAccionesAbonos, usePlanesAbono, type PlanAbono, type TipoAbono } from "./use-abonos";

const selectCls = "h-8 rounded-lg border bg-transparent px-2 text-sm";

/** Los planes que se venden. Cada uno crea su servicio en Productos (con eso sale cada cuota en la venta). */
export function PlanesAbono() {
  const planes = usePlanesAbono();
  const rol = useRol();
  const [editando, setEditando] = useState<string | "nuevo" | null>(null);
  const { borrarPlan } = useAccionesAbonos();

  if (planes.isLoading) return <Skeleton className="h-40 w-full" />;
  return (
    <div className="flex flex-col gap-3">
      {(planes.data ?? []).map((p) =>
        editando === p.id ? (
          <PlanForm key={p.id} inicial={p} onListo={() => setEditando(null)} />
        ) : (
          <Card key={p.id}>
            <CardContent className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {p.nombre} {!p.activo && <span className="text-xs font-normal text-muted-foreground">(pausado)</span>}
                </p>
                <p className="text-sm text-muted-foreground">
                  {detallePlan(p)} · {p.abonados === 1 ? "1 abonado" : `${p.abonados} abonados`}
                </p>
              </div>
              <span className="font-semibold">{formatoPesos(p.precio)}</span>
              {rol === "dueno" && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => setEditando(p.id)} aria-label={`Editar ${p.nombre}`}>
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Borrar ${p.nombre}`}
                    onClick={() => window.confirm(`¿Borrar el plan ${p.nombre}?`) && borrarPlan.mutate(p.id, { onSuccess: () => toast.success("Plan borrado"), onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo borrar") })}
                  >
                    <Trash2 />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ),
      )}
      {rol === "dueno" &&
        (editando === "nuevo" ? (
          <PlanForm onListo={() => setEditando(null)} />
        ) : (
          <Button variant="outline" className="w-fit" onClick={() => setEditando("nuevo")}>
            <Plus aria-hidden /> Nuevo plan
          </Button>
        ))}
      {rol !== "dueno" && !planes.data?.length && <p className="text-sm text-muted-foreground">Los planes los arma el dueño.</p>}
    </div>
  );
}

function PlanForm({ inicial, onListo }: { inicial?: PlanAbono; onListo: () => void }) {
  const { crearPlan, editarPlan } = useAccionesAbonos();
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [tipo, setTipo] = useState<TipoAbono>(inicial?.tipo ?? "mensual");
  const [precio, setPrecio] = useState(inicial ? String(inicial.precio) : "");
  const [sesiones, setSesiones] = useState(inicial?.sesiones ? String(inicial.sesiones) : "");
  const [vigencia, setVigencia] = useState(inicial?.vigenciaDias ? String(inicial.vigenciaDias) : "60");
  const [activo, setActivo] = useState(inicial?.activo ?? true);
  const [actualizar, setActualizar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const guardando = crearPlan.isPending || editarPlan.isPending;
  const cambiaPrecio = inicial && aNumero(precio) !== inicial.precio;

  function guardar() {
    if (!nombre.trim()) return setError("Poné un nombre.");
    if (aNumero(precio) <= 0) return setError("Poné el precio.");
    if (tipo === "paquete" && !(Number(sesiones) > 0)) return setError("Un paquete necesita la cantidad de sesiones.");
    setError(null);
    const datos = { nombre: nombre.trim(), tipo, precio: aNumero(precio), sesiones: Number(sesiones) > 0 ? Number(sesiones) : null, vigenciaDias: tipo === "paquete" ? Number(vigencia) || 60 : null, activo, actualizarAbonos: Boolean(cambiaPrecio && actualizar) };
    const listo = { onSuccess: () => (toast.success(`Plan ${datos.nombre} guardado`), onListo()), onError: (e: unknown) => setError(e instanceof Error ? e.message : "No se pudo guardar") };
    if (inicial) editarPlan.mutate({ id: inicial.id, ...datos }, listo);
    else crearPlan.mutate(datos, listo);
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pl-nombre">Nombre</Label>
            <Input id="pl-nombre" maxLength={80} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Pase libre, 8 clases por mes" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pl-precio">Precio</Label>
            <InputPlata id="pl-precio" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="Ej. 25000" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pl-tipo">Tipo</Label>
            <select id="pl-tipo" className={selectCls} value={tipo} onChange={(e) => setTipo(e.target.value as TipoAbono)}>
              <option value="mensual">Mensual (se renueva cada mes)</option>
              <option value="paquete">Paquete de sesiones (con vencimiento)</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pl-sesiones">{tipo === "mensual" ? "Sesiones por mes (vacío = libre)" : "Cantidad de sesiones"}</Label>
            <Input id="pl-sesiones" type="number" min={1} max={500} value={sesiones} onChange={(e) => setSesiones(e.target.value)} placeholder={tipo === "mensual" ? "Libre" : "Ej. 10"} />
          </div>
          {tipo === "paquete" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pl-vigencia">Vale por (días)</Label>
              <Input id="pl-vigencia" type="number" min={1} max={730} value={vigencia} onChange={(e) => setVigencia(e.target.value)} />
            </div>
          )}
        </div>
        {inicial && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
            Activo (si lo pausás, no se le da a clientes nuevos)
          </label>
        )}
        {cambiaPrecio && inicial.abonados > 0 && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={actualizar} onChange={(e) => setActualizar(e.target.checked)} />
            Aplicar el precio nuevo a los {inicial.abonados} abonados actuales (desde su próxima cuota)
          </label>
        )}
        {!inicial && <p className="text-xs text-muted-foreground">Se crea solo un servicio con este nombre en Productos: con eso sale cada cuota en la venta y en los reportes.</p>}
        {error && <p className="rounded-md bg-destructive/10 p-2 text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button onClick={guardar} disabled={guardando}>
            {guardando && <Loader2 className="animate-spin" aria-hidden />}
            Guardar
          </Button>
          <Button variant="ghost" onClick={onListo}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

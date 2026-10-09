"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputPlata } from "@/components/shared/input-plata";
import { Label } from "@/components/ui/label";
import { useAccionesObjetivo, type GuardarObjetivo, type Objetivo, type OpcionesObjetivo, type TipoObjetivo } from "../hooks/use-objetivos";
import { aNumero } from "@/lib/numeros";
import { CON_PRODUCTO, EN_DINERO, PERIODOS, TIPOS } from "../objetivos";
import { MetasPorPeriodo } from "./MetasPorPeriodo";

const selectCls = "h-9 w-full rounded-lg border bg-transparent px-2 text-sm";
type Alcance = "empresa" | "sucursal" | "usuario";

/** Alta o edición de un objetivo (solo el dueño). En Básico solo facturación de toda la empresa. */
export function ObjetivoForm({ opciones, inicial, onCerrar }: { opciones: OpcionesObjetivo; inicial?: Objetivo; onCerrar: () => void }) {
  const { guardar } = useAccionesObjetivo();
  const [tipo, setTipo] = useState<TipoObjetivo>(inicial?.tipo ?? "facturacion");
  const [periodo, setPeriodo] = useState(inicial?.periodo ?? "mes");
  const [meta, setMeta] = useState(inicial ? String(inicial.meta) : "");
  const [moneda, setMoneda] = useState<"ARS" | "USD">(inicial?.moneda ?? "ARS");
  const [alcance, setAlcance] = useState<Alcance>(inicial?.usuario ? "usuario" : inicial?.ubicacion ? "sucursal" : "empresa");
  const [ubicacion, setUbicacion] = useState(inicial?.ubicacion ?? opciones.ubicaciones[0] ?? "");
  const [usuarioId, setUsuarioId] = useState(inicial?.usuario?.id ?? opciones.usuarios[0]?.id ?? "");
  const [productoId, setProductoId] = useState(inicial?.producto?.id ?? "");

  const conMoneda = EN_DINERO.includes(tipo);
  const avanzado = opciones.avanzados;

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    const numero = aNumero(meta);
    if (!(numero > 0)) return toast.error("Poné una meta mayor a cero");
    const datos: GuardarObjetivo = {
      tipo,
      periodo,
      meta: numero,
      moneda: conMoneda ? moneda : "ARS",
      ubicacion: alcance === "sucursal" ? ubicacion || null : null,
      usuarioId: alcance === "usuario" ? usuarioId || null : null,
      productoId: CON_PRODUCTO.includes(tipo) && productoId ? productoId : null,
    };
    guardar.mutate(
      { id: inicial?.id, datos },
      {
        onSuccess: () => {
          toast.success(inicial ? "Objetivo actualizado" : "Objetivo creado");
          onCerrar();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "No se pudo guardar"),
      },
    );
  };

  const ayuda = TIPOS.find((t) => t.id === tipo)?.ayuda;
  const unidad =
    tipo === "dias_despacho" ? "días (máximo)" : tipo === "a_tiempo" ? "%" : CON_PRODUCTO.includes(tipo) ? "unidades" : tipo === "despachos" ? "pedidos" : tipo === "clientes_nuevos" ? "clientes" : moneda === "USD" ? "US$" : "$";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{inicial ? "Editar objetivo" : "Nuevo objetivo"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="obj-tipo">Qué medir</Label>
            <select id="obj-tipo" className={selectCls} value={tipo} onChange={(e) => setTipo(e.target.value as TipoObjetivo)}>
              {TIPOS.map((t) => (
                <option key={t.id} value={t.id} disabled={t.avanzado && !avanzado}>
                  {t.nombre}
                  {t.avanzado && !avanzado ? " (desde Pro)" : ""}
                </option>
              ))}
            </select>
            {ayuda && <p className="text-xs text-muted-foreground">{ayuda}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="obj-periodo">Cada</Label>
            <select id="obj-periodo" className={selectCls} value={periodo} onChange={(e) => setPeriodo(e.target.value as typeof periodo)}>
              {PERIODOS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Se repite solo cada período.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="obj-meta">Meta ({unidad})</Label>
            <InputPlata formato={conMoneda} moneda={moneda} id="obj-meta" value={meta} onChange={(e) => setMeta(e.target.value)} placeholder={tipo === "a_tiempo" ? "95" : tipo === "dias_despacho" ? "2" : "1000000"} />
          </div>
          {conMoneda ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="obj-moneda">Moneda</Label>
              <select id="obj-moneda" className={selectCls} value={moneda} onChange={(e) => setMoneda(e.target.value as "ARS" | "USD")}>
                <option value="ARS">Pesos</option>
                <option value="USD">Dólares (cotización de cada día)</option>
              </select>
            </div>
          ) : (
            <div />
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="obj-alcance">Para</Label>
            <select id="obj-alcance" className={selectCls} value={alcance} onChange={(e) => setAlcance(e.target.value as Alcance)}>
              <option value="empresa">Toda la empresa</option>
              <option value="sucursal" disabled={!avanzado || opciones.ubicaciones.length === 0 || tipo === "cobranza"}>
                Una sucursal{!avanzado ? " (desde Pro)" : tipo === "cobranza" ? " (no aplica a cobranza)" : ""}
              </option>
              <option value="usuario" disabled={!avanzado}>
                Un usuario{!avanzado ? " (desde Pro)" : ""}
              </option>
            </select>
          </div>
          {alcance === "sucursal" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="obj-sucursal">Sucursal</Label>
              <select id="obj-sucursal" className={selectCls} value={ubicacion} onChange={(e) => setUbicacion(e.target.value)}>
                {opciones.ubicaciones.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          )}
          {alcance === "usuario" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="obj-usuario">Usuario</Label>
              <select id="obj-usuario" className={selectCls} value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
                {opciones.usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
          {CON_PRODUCTO.includes(tipo) && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="obj-producto">Producto</Label>
              <select id="obj-producto" className={selectCls} value={productoId} onChange={(e) => setProductoId(e.target.value)}>
                <option value="">Todos los productos</option>
                {opciones.productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          {inicial && <MetasPorPeriodo objetivo={inicial} />}

          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4 lg:justify-end">
            <Button type="button" variant="ghost" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardar.isPending}>
              {guardar.isPending ? "Guardando…" : inicial ? "Guardar cambios" : "Crear objetivo"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

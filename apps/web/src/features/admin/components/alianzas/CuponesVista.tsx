"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { fechaAR, NOMBRE_CICLO, NOMBRE_TIPO_CUPON, useAccionesAlianzas, useCupones, type Ciclo, type Cupon, type CuponDatos } from "../../hooks/use-alianzas";
import { Panel } from "../comunes";
import { CUPON_VACIO, CuponForm } from "./CuponForm";

/** Resumen corto de las reglas: "Trimestral: 40% (3 cuotas) · Anual: 25% el 1.º, 20% renovaciones". */
function resumenReglas(c: Cupon) {
  const partes = (Object.keys(NOMBRE_CICLO) as Ciclo[]).flatMap((ciclo) => {
    const r = c.reglas[ciclo];
    if (!r) return [];
    const meses = ciclo === "anual" ? 12 : ciclo === "trimestral" ? 3 : 1;
    let restantes = meses;
    let suma = 0;
    for (const t of r.entrada) {
      const m = Math.min(t.meses, restantes);
      suma += m * t.porcentaje;
      restantes -= m;
    }
    const entrada = Math.round((suma / meses) * 10) / 10;
    if (!entrada && !r.renovacionPct) return [];
    const textos = [entrada ? `${entrada}% el 1.º${r.cuotas > 1 ? ` (${r.cuotas} cuotas)` : ""}` : null, r.renovacionPct ? `${r.renovacionPct}% renovaciones` : null].filter(Boolean);
    return [`${NOMBRE_CICLO[ciclo]}: ${textos.join(", ")}`];
  });
  return partes.join(" · ") || "Sin descuentos";
}

export function CuponesVista() {
  const cupones = useCupones();
  const { crearCupon, editarCupon } = useAccionesAlianzas();
  const [editando, setEditando] = useState<Cupon | "nuevo" | null>(null);

  function guardar(d: CuponDatos) {
    const fin = { onSuccess: () => { toast.success("Cupón guardado"); setEditando(null); }, onError: (e: Error) => toast.error(e.message) };
    if (editando === "nuevo") crearCupon.mutate(d, fin);
    else if (editando) editarCupon.mutate({ id: editando.id, ...d }, fin);
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href="/admin/alianzas" className="text-sm text-muted-foreground hover:underline">
            ← Alianzas
          </Link>
          <h1 className="text-xl font-semibold">Cupones</h1>
          <p className="text-sm text-muted-foreground">Códigos de cámaras, de descuento y de referidos. Desactivar un código no le quita los beneficios a quien ya lo usó.</p>
        </div>
        <Button onClick={() => setEditando(editando ? null : "nuevo")}>{editando ? "Cerrar" : "Nuevo cupón"}</Button>
      </div>

      {editando && (
        <Panel titulo={editando === "nuevo" ? "Nuevo cupón" : `Editar ${editando.codigo}`}>
          <CuponForm
            key={editando === "nuevo" ? "nuevo" : editando.id}
            inicial={editando === "nuevo" ? CUPON_VACIO : editando}
            guardando={crearCupon.isPending || editarCupon.isPending}
            onGuardar={guardar}
            onCancelar={() => setEditando(null)}
          />
        </Panel>
      )}

      <Panel titulo="Códigos">
        {cupones.isPending ? (
          <CargandoFilas filas={3} />
        ) : cupones.isError ? (
          <ErrorDatos error={cupones.error} onReintentar={() => cupones.refetch()} />
        ) : cupones.data.length === 0 ? (
          <SinDatos mensaje="Todavía no hay cupones." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead className="hidden md:table-cell">Tipo</TableHead>
                <TableHead className="hidden lg:table-cell">Beneficios</TableHead>
                <TableHead className="hidden text-right md:table-cell">Usos</TableHead>
                <TableHead className="hidden md:table-cell">Vigencia</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {cupones.data.map((c) => (
                <TableRow key={c.id} className={c.activo ? undefined : "opacity-60"}>
                  <TableCell className="whitespace-normal">
                    <span className="font-mono font-medium">{c.codigo}</span>
                    <span className="block text-xs text-muted-foreground">{c.camara ?? "Sin cámara"}{c.diasPrueba ? ` · ${c.diasPrueba} días gratis` : ""}</span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{NOMBRE_TIPO_CUPON[c.tipo]}</TableCell>
                  <TableCell className="hidden max-w-80 whitespace-normal text-xs lg:table-cell">{resumenReglas(c)}</TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">{c.usos}{c.maxUsos ? ` / ${c.maxUsos}` : ""}</TableCell>
                  <TableCell className="hidden text-xs tabular-nums md:table-cell">{c.desde || c.hasta ? `${fechaAR(c.desde)} → ${fechaAR(c.hasta)}` : "Siempre"}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => setEditando(c)}>
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant={c.activo ? "ghost" : "outline"}
                      disabled={editarCupon.isPending}
                      onClick={() => editarCupon.mutate({ id: c.id, activo: !c.activo }, { onSuccess: () => toast.success(c.activo ? "Cupón desactivado" : "Cupón activado"), onError: (e) => toast.error(e.message) })}
                    >
                      {c.activo ? "Desactivar" : "Activar"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
    </>
  );
}

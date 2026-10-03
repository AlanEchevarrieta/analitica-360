"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { formatoPesos } from "@/lib/formato";
import { pct, useAccionesAlianzas, useCamaras, useResumenAlianzas } from "../../hooks/use-alianzas";
import { Indicador, Panel } from "../comunes";
import { CAMARA_VACIA, CamaraForm } from "./CamaraForm";

const nombreMes = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("es-AR", { month: "short", year: "2-digit" });

/** Alianzas: indicadores generales, cámaras y alta de una nueva. */
export function AlianzasVista() {
  const router = useRouter();
  const resumen = useResumenAlianzas();
  const camaras = useCamaras();
  const { crearCamara } = useAccionesAlianzas();
  const [nueva, setNueva] = useState(false);
  const r = resumen.data;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Alianzas</h1>
          <p className="text-sm text-muted-foreground">Cámaras que nos traen clientes, sus códigos y la comisión que les corresponde. El emprendedor nunca ve nada de esto.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/alianzas/cupones" className={buttonVariants({ variant: "outline" })}>
            Cupones
          </Link>
          <Link href="/admin/alianzas/cuotas" className={buttonVariants({ variant: "outline" })}>
            Cuotas
          </Link>
          <Button onClick={() => setNueva((v) => !v)}>{nueva ? "Cerrar" : "Nueva cámara"}</Button>
        </div>
      </div>

      {nueva && (
        <Panel titulo="Nueva cámara" descripcion="Arranca con los tramos de la UCIM; cambialos si esta cámara tiene otras condiciones.">
          <CamaraForm
            inicial={CAMARA_VACIA}
            guardando={crearCamara.isPending}
            onCancelar={() => setNueva(false)}
            onGuardar={(d) =>
              crearCamara.mutate(d, {
                onSuccess: (c) => {
                  toast.success("Cámara creada. Ahora creale su código en Cupones.");
                  router.push(`/admin/alianzas/${c.id}`);
                },
                onError: (e) => toast.error(e.message),
              })
            }
          />
        </Panel>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador etiqueta="Comisión de este mes" valor={r ? formatoPesos(r.comisionMes) : "…"} detalle="Generada por los cobros del mes" />
        <Indicador etiqueta="Aprobada sin pagar" valor={r ? formatoPesos(r.aprobadasSinPagar) : "…"} detalle="Liquidaciones a transferir" tono={r && r.aprobadasSinPagar > 0 ? "mal" : "neutro"} />
        <Indicador etiqueta="Descuentos por cupones" valor={r ? formatoPesos(r.descuentosOtorgados) : "…"} detalle="Total otorgado" />
        <Indicador
          etiqueta="Comisión estimada"
          valor={r ? formatoPesos(r.estimadoProximosMeses[0]?.monto ?? 0) : "…"}
          detalle={r ? `por mes con los clientes activos · 6 meses: ${formatoPesos(r.estimadoProximosMeses.reduce((a, m) => a + m.monto, 0))}` : undefined}
        />
      </div>

      {r && r.estimadoProximosMeses.some((m) => m.monto > 0) && (
        <Panel titulo="Comisión estimada de los próximos meses" descripcion="Si los clientes activos siguen pagando lo mismo, hasta que se cumpla su plazo de comisión">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {r.estimadoProximosMeses.map((m) => (
              <div key={m.mes} className="rounded-lg border p-2 text-center">
                <div className="text-xs text-muted-foreground capitalize">{nombreMes(m.mes)}</div>
                <div className="font-medium tabular-nums">{formatoPesos(m.monto)}</div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel titulo="Cámaras" descripcion="Clientes que llegó cada una y cuántos pasaron de la prueba gratis a pagar">
        {camaras.isPending ? (
          <CargandoFilas filas={3} />
        ) : camaras.isError ? (
          <ErrorDatos error={camaras.error} onReintentar={() => camaras.refetch()} />
        ) : camaras.data.length === 0 ? (
          <SinDatos mensaje="Todavía no hay cámaras." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cámara</TableHead>
                <TableHead className="hidden md:table-cell">Códigos</TableHead>
                <TableHead className="text-right">Registros</TableHead>
                <TableHead className="text-right">Pagan</TableHead>
                <TableHead className="hidden text-right md:table-cell">Conversión</TableHead>
                <TableHead className="hidden text-right md:table-cell">Activos</TableHead>
                <TableHead className="text-right">Comisión total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {camaras.data.map((c) => (
                <TableRow key={c.id} className={c.activa ? undefined : "opacity-60"}>
                  <TableCell className="font-medium">
                    <Link href={`/admin/alianzas/${c.id}`} className="hover:underline">
                      {c.nombre}
                    </Link>
                    {!c.activa && <span className="ml-2 text-xs text-muted-foreground">(inactiva)</span>}
                  </TableCell>
                  <TableCell className="hidden text-xs md:table-cell">{c.codigos.map((k) => k.codigo).join(", ") || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.registros}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.pagan}</TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">{pct(c.conversion)}</TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">{c.activos}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatoPesos(c.comisionTotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
    </>
  );
}

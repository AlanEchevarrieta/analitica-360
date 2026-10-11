"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CargandoFilas, ErrorDatos } from "@/components/shared/estado-datos";
import { useAccionesPrecios, usePanelPrecios, type PanelPrecios } from "../hooks/use-precios-admin";
import { Panel } from "./comunes";

const pesos = (n: number) => `$ ${n.toLocaleString("es-AR")}`;
const dia = (f: string) => new Date(`${f}T12:00:00Z`).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const mesCorto = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("es-AR", { month: "short", year: "2-digit", timeZone: "UTC" });
/** Mismo redondeo que la API (a los $100). */
const conAumento = (precio: number, pct: number) => Math.round((precio * (1 + pct / 100)) / 100) * 100;

function NuevoAumento({ panel }: { panel: PanelPrecios }) {
  const { programar } = useAccionesPrecios();
  const [fecha, setFecha] = useState(panel.primeraFechaPosible);
  const [pct, setPct] = useState(panel.ipc ? String(panel.ipc.acumulada) : "");
  const [motivo, setMotivo] = useState("");
  const porcentaje = Number(pct.replace(",", "."));
  const valido = porcentaje > 0 && porcentaje <= 100 && fecha >= panel.primeraFechaPosible;

  const confirmar = () => {
    const texto = `Se avisa por email a todos los clientes que desde el ${dia(fecha)} los precios suben ${porcentaje.toLocaleString("es-AR")} %. ¿Seguimos?`;
    if (!window.confirm(texto)) return;
    programar.mutate(
      { vigenteDesde: fecha, porcentaje, motivo: motivo.trim() || undefined },
      { onSuccess: () => toast.success(panel.emailConfigurado ? "Aumento programado y aviso enviado" : "Aumento programado. El aviso sale cuando esté configurado el email"), onError: (e) => toast.error(e.message) },
    );
  };

  return (
    <Panel titulo="Programar un aumento" descripcion="Los clientes reciben el aviso por email con 30 días de anticipación. El precio nuevo rige desde su próximo pago a partir de esa fecha; el anual ya pago no cambia hasta que se renueva.">
      {panel.ipc && (
        <p className="mb-4 text-sm text-muted-foreground">
          IPC de los últimos 3 meses: {panel.ipc.meses.map((m) => `${mesCorto(m.mes)} ${m.valor.toLocaleString("es-AR")} %`).join(" · ")} → <span className="font-medium text-foreground">{panel.ipc.acumulada.toLocaleString("es-AR")} % acumulado</span>
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="precio-fecha">Rige desde</Label>
          <Input id="precio-fecha" type="date" min={panel.primeraFechaPosible} value={fecha} onChange={(e) => setFecha(e.target.value)} />
          <span className="text-xs text-muted-foreground">Lo antes posible: {dia(panel.primeraFechaPosible)}</span>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="precio-pct">Aumento (%)</Label>
          <Input id="precio-pct" inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} placeholder="Ej. 7,3" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="precio-motivo">Motivo (sale en el email)</Label>
          <Input id="precio-motivo" maxLength={200} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. IPC de julio a septiembre" />
        </div>
      </div>
      {porcentaje > 0 && (
        <Table className="mt-4">
          <TableHeader>
            <TableRow>
              <TableHead>Plan</TableHead>
              <TableHead className="text-right">Hoy</TableHead>
              <TableHead className="text-right">Desde {dia(fecha)}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {panel.actuales.map((p) => (
              <TableRow key={p.plan}>
                <TableCell className="font-medium">{p.nombre}</TableCell>
                <TableCell className="text-right tabular-nums">{pesos(p.precioMensual)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{pesos(conAumento(p.precioMensual, porcentaje))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {!panel.emailConfigurado && <p className="mt-3 text-sm text-amber-400">El envío de emails todavía no está configurado (falta Resend). El aumento queda programado y el aviso sale solo cuando se configure; si sale tarde, el precio se corre para respetar los 30 días.</p>}
      <div className="mt-4 flex justify-end">
        <Button disabled={!valido || programar.isPending} onClick={confirmar}>
          {programar.isPending ? "Programando…" : "Programar y avisar"}
        </Button>
      </div>
    </Panel>
  );
}

function Programados({ panel }: { panel: PanelPrecios }) {
  const { cancelar, avisar } = useAccionesPrecios();
  if (panel.programados.length === 0) return null;
  const sinAviso = panel.programados.some((p) => !p.avisadoEl);
  return (
    <Panel
      titulo="Aumentos programados"
      accion={
        sinAviso && panel.emailConfigurado ? (
          <Button size="sm" variant="outline" disabled={avisar.isPending} onClick={() => avisar.mutate(undefined, { onSuccess: (r) => toast.success(`Avisos enviados: ${r.enviados}`), onError: (e) => toast.error(e.message) })}>
            Mandar aviso ahora
          </Button>
        ) : undefined
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Plan</TableHead>
            <TableHead className="text-right">Precio</TableHead>
            <TableHead>Rige desde</TableHead>
            <TableHead>Aviso</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {panel.programados.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">{p.nombre}</TableCell>
              <TableCell className="text-right tabular-nums">
                <span className="text-muted-foreground">{pesos(p.antes)} → </span>
                {pesos(p.precioMensual)}
              </TableCell>
              <TableCell>
                {dia(p.rigeDesde ?? p.vigenteDesde)}
                {p.rigeDesde && p.rigeDesde !== p.vigenteDesde && <span className="block text-xs text-amber-400">Se corrió: el aviso salió tarde</span>}
              </TableCell>
              <TableCell className="text-sm">{p.avisadoEl ? `Enviado el ${dia(p.avisadoEl)} (${p.avisados} emails)` : <span className="text-amber-400">Pendiente</span>}</TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={cancelar.isPending}
                  onClick={() => window.confirm(`¿Cancelar el aumento del ${p.nombre}?${p.avisadoEl ? " Los clientes ya recibieron el aviso: conviene escribirles para aclarar." : ""}`) && cancelar.mutate(p.id, { onSuccess: () => toast.success("Aumento cancelado"), onError: (e) => toast.error(e.message) })}
                >
                  Cancelar
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
}

/** Consola → Precios: precios de lista de hoy, aumentos por IPC programados (con aviso de 30 días) e historial. */
export function PreciosVista() {
  const panel = usePanelPrecios();
  return (
    <>
      <div>
        <h1 className="text-xl font-semibold">Precios</h1>
        <p className="text-sm text-muted-foreground">Precios de lista por mes, sin IVA. Los descuentos del trimestral (−15 %), del anual (−25 %) y de los códigos se calculan sobre estos precios.</p>
      </div>
      {panel.isPending ? (
        <Panel titulo="Precios de hoy">
          <CargandoFilas filas={3} />
        </Panel>
      ) : panel.isError ? (
        <ErrorDatos error={panel.error} onReintentar={() => panel.refetch()} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {panel.data.actuales.map((p) => (
              <div key={p.plan} className="rounded-xl border bg-card/80 p-4">
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{p.nombre}</span>
                <p className="text-2xl font-semibold tabular-nums">{pesos(p.precioMensual)}</p>
                <span className="text-xs text-muted-foreground">por mes, hoy</span>
              </div>
            ))}
          </div>
          <Programados panel={panel.data} />
          <NuevoAumento key={panel.data.primeraFechaPosible} panel={panel.data} />
          {panel.data.historial.length > 0 && (
            <Panel titulo="Historial">
              <ul className="grid gap-1 text-sm">
                {panel.data.historial.map((h) => (
                  <li key={h.id} className="flex flex-wrap justify-between gap-2">
                    <span>
                      {h.nombre}: <span className="tabular-nums">{pesos(h.precioMensual)}</span>
                      {h.motivo && <span className="text-muted-foreground"> · {h.motivo}</span>}
                    </span>
                    <span className="text-muted-foreground">desde {dia(h.rigeDesde)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </>
      )}
    </>
  );
}

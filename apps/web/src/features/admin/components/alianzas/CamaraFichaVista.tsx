"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { CargandoFilas, ErrorDatos } from "@/components/shared/estado-datos";
import { formatoPesos } from "@/lib/formato";
import { pct, useAccionesAlianzas, useFichaCamara } from "../../hooks/use-alianzas";
import { Indicador, Panel } from "../comunes";
import { CamaraForm } from "./CamaraForm";
import { ClientesCamara } from "./ClientesCamara";
import { LiquidacionPanel } from "./LiquidacionPanel";

export function CamaraFichaVista({ id }: { id: string }) {
  const ficha = useFichaCamara(id);
  const { editarCamara } = useAccionesAlianzas();
  const [editando, setEditando] = useState(false);

  if (ficha.isPending) return <CargandoFilas filas={6} />;
  if (ficha.isError) return <ErrorDatos error={ficha.error} onReintentar={() => ficha.refetch()} />;
  const { camara, cupones, indicadores: k, clientes } = ficha.data;
  const datos = { nombre: camara.nombre, contactoNombre: camara.contactoNombre, contactoEmail: camara.contactoEmail, contactoTelefono: camara.contactoTelefono, activa: camara.activa, mesesComision: camara.mesesComision, tramos: camara.tramos, notas: camara.notas };

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href="/admin/alianzas" className="text-sm text-muted-foreground hover:underline">
            ← Alianzas
          </Link>
          <h1 className="text-xl font-semibold">
            {camara.nombre} {!camara.activa && <span className="text-sm font-normal text-muted-foreground">(inactiva)</span>}
          </h1>
          <p className="text-sm text-muted-foreground">
            {[camara.contactoNombre, camara.contactoEmail, camara.contactoTelefono].filter(Boolean).join(" · ") || "Sin contacto cargado"} · comisión durante {camara.mesesComision} meses desde el primer pago
          </p>
        </div>
        <Button variant="outline" onClick={() => setEditando((v) => !v)}>
          {editando ? "Cerrar" : "Editar cámara"}
        </Button>
      </div>

      {editando && (
        <Panel titulo="Editar cámara" descripcion="Los cambios de tramos o plazo valen para los clientes nuevos: lo ya calculado no se recalcula.">
          <CamaraForm
            inicial={datos}
            guardando={editarCamara.isPending}
            onCancelar={() => setEditando(false)}
            onGuardar={(d) =>
              editarCamara.mutate(
                { id, ...d },
                {
                  onSuccess: () => {
                    toast.success("Cámara actualizada");
                    setEditando(false);
                  },
                  onError: (e) => toast.error(e.message),
                },
              )
            }
          />
        </Panel>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador etiqueta="Registros con sus códigos" valor={k.registros} detalle={`${k.enPrueba} en el mes gratis`} />
        <Indicador etiqueta="Pasaron a pagar" valor={k.convertidos} detalle={`Conversión ${pct(k.conversion)}`} />
        <Indicador etiqueta="Clientes activos" valor={k.activos} detalle={`+${k.nuevosMes} nuevos · −${k.bajasMes} bajas este mes · tasa de bajas ${pct(k.tasaBajas)}`} />
        <Indicador
          etiqueta="Tramo actual"
          valor={`${k.tramo.porcentaje}%`}
          detalle={k.tramo.faltanParaSiguiente != null ? `faltan ${k.tramo.faltanParaSiguiente} clientes para el ${k.tramo.siguientePorcentaje}%` : "último tramo (tope)"}
        />
        <Indicador etiqueta="Facturaron este mes" valor={formatoPesos(k.facturadoMes)} detalle={`Total: ${formatoPesos(k.facturadoTotal)}`} />
        <Indicador etiqueta="Descuentos otorgados" valor={formatoPesos(k.descuentosOtorgados)} />
        <Indicador etiqueta="Comisión del mes" valor={formatoPesos(k.comisionMes)} />
        <Indicador etiqueta="Comisión total" valor={formatoPesos(k.comisionTotal)} detalle={`${k.tramo.clientesConNumero} clientes con número`} />
      </div>

      <Panel
        titulo="Códigos"
        descripcion="Todos suman para esta cámara"
        accion={
          <Link href="/admin/alianzas/cupones" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Administrar cupones
          </Link>
        }
      >
        {cupones.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no tiene códigos.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {cupones.map((c) => (
              <span key={c.id} className={`rounded border px-2 py-1 text-sm ${c.activo ? "" : "opacity-50 line-through"}`} title={c.descripcion ?? undefined}>
                <span className="font-mono font-medium">{c.codigo}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {c.usos} usos{c.maxUsos ? ` de ${c.maxUsos}` : ""}
                  {c.diasPrueba ? ` · ${c.diasPrueba} días gratis` : ""}
                </span>
              </span>
            ))}
          </div>
        )}
      </Panel>

      <Panel titulo="Clientes" descripcion="Por número de orden: el número se asigna con el primer pago y no cambia aunque otros se den de baja">
        <ClientesCamara clientes={clientes} />
      </Panel>

      <LiquidacionPanel camaraId={id} camaraNombre={camara.nombre} />
    </>
  );
}

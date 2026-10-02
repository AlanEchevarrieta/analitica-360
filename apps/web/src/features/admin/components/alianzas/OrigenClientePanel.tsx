"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fechaAR, useAccionesAlianzas, useCamaras, useCupones, useOrigenCliente } from "../../hooks/use-alianzas";
import { Panel } from "../comunes";

const selectClase = "h-8 rounded-lg border bg-transparent px-2 text-sm";

/** De qué cámara vino el cliente. Solo el admin lo corrige, y cada cambio queda registrado con su motivo. */
export function OrigenClientePanel({ empresaId }: { empresaId: string }) {
  const origen = useOrigenCliente(empresaId);
  const camaras = useCamaras();
  const cupones = useCupones();
  const { cambiarOrigen } = useAccionesAlianzas();
  const [editando, setEditando] = useState(false);
  const [f, setF] = useState({ camaraId: "", cuponId: "", motivo: "" });
  const a = origen.data?.actual;

  function guardar() {
    if (f.motivo.trim().length < 5) return toast.error("Contá brevemente por qué se cambia.");
    cambiarOrigen.mutate(
      { empresaId, camaraId: f.camaraId || null, cuponId: f.cuponId || null, motivo: f.motivo },
      {
        onSuccess: () => {
          toast.success("Origen actualizado");
          setEditando(false);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  }

  return (
    <Panel
      titulo="Origen (alianzas)"
      descripcion="De qué cámara vino y con qué código"
      accion={
        <Button size="sm" variant="outline" onClick={() => {
          setF({ camaraId: a?.camaraId ?? "", cuponId: a?.cuponId ?? "", motivo: "" });
          setEditando((v) => !v);
        }}>
          {editando ? "Cerrar" : "Corregir"}
        </Button>
      }
    >
      {!a ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <div className="flex flex-col gap-3 text-sm">
          <p>
            {a.camara ? (
              <>
                Vino por <strong>{a.camara}</strong>
                {a.codigo && <> con el código <span className="font-mono">{a.codigo}</span></>}
                {a.orden != null && <> · cliente n.º {a.orden} al {a.porcentaje}% hasta el {fechaAR(a.comisionHasta)}</>}
              </>
            ) : (
              <span className="text-muted-foreground">Sin cámara de origen{a.codigo ? ` (código ${a.codigo})` : ""}.</span>
            )}
          </p>

          {editando && (
            <div className="flex flex-col gap-2 rounded-xl border p-3">
              <div className="flex flex-wrap gap-2">
                <select className={selectClase} aria-label="Cámara" value={f.camaraId} onChange={(e) => setF({ ...f, camaraId: e.target.value, cuponId: "" })}>
                  <option value="">Sin cámara</option>
                  {(camaras.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
                <select className={selectClase} aria-label="Código" value={f.cuponId} onChange={(e) => setF({ ...f, cuponId: e.target.value })}>
                  <option value="">Sin código</option>
                  {(cupones.data ?? []).filter((k) => !f.camaraId || k.camaraId === f.camaraId).map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.codigo}
                    </option>
                  ))}
                </select>
              </div>
              <Input placeholder="Motivo del cambio (queda registrado)" aria-label="Motivo" value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })} />
              <p className="text-xs text-muted-foreground">Si cambia de cámara, el número de orden y el porcentaje se asignan de nuevo con su próximo pago. Lo ya liquidado no cambia.</p>
              <Button className="w-fit" onClick={guardar} disabled={cambiarOrigen.isPending}>
                Guardar cambio
              </Button>
            </div>
          )}

          {(origen.data?.historial.length ?? 0) > 0 && (
            <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
              {origen.data!.historial.map((h) => (
                <li key={h.id}>
                  {fechaAR(h.createdAt)} · {h.antes} → {h.despues} · {h.motivo} ({h.hechoPor})
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Panel>
  );
}

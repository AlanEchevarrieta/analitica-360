"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApiFetch } from "@/hooks/use-api";
import { formatoPesos } from "@/lib/formato";
import { hoyAR } from "@/lib/periodos";
import { Panel } from "./comunes";

const CATEGORIAS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"];
type Vigencia = { vigencia: string; topes: { categoria: string; topeAnual: number }[] };
const aNumero = (t: string) => Number(t.replace(/\./g, "").replace(",", "."));

/** La consola carga los topes del monotributo una vez por semestre (febrero y agosto) para todos los clientes. */
export function TopesMonotributo() {
  const api = useApiFetch();
  const { orgId } = useAuth();
  const queryClient = useQueryClient();
  const lista = useQuery({ queryKey: ["admin", "topes", orgId], queryFn: () => api<Vigencia[]>("/admin/monotributo/topes"), enabled: Boolean(orgId) });
  const [abierto, setAbierto] = useState(false);
  const [vigencia, setVigencia] = useState("");
  const [valores, setValores] = useState<Record<string, string>>({});
  const guardar = useMutation({
    mutationFn: () =>
      api("/admin/monotributo/topes", { method: "PUT", body: JSON.stringify({ vigencia, topes: CATEGORIAS.map((c) => ({ categoria: c, topeAnual: aNumero(valores[c] ?? "") })) }) }),
    onSuccess: () => {
      toast.success("Topes guardados: ya se usan para todos los clientes");
      setAbierto(false);
      void queryClient.invalidateQueries({ queryKey: ["admin", "topes"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudieron guardar"),
  });
  const actual = lista.data?.[0];
  const edad = actual ? Math.round((Date.parse(hoyAR()) - Date.parse(actual.vigencia)) / (30 * 86_400_000)) : null;

  return (
    <Panel
      titulo="Topes del monotributo"
      descripcion="ARCA los actualiza en febrero y agosto. Cargalos acá y se aplican a todos los clientes."
      accion={
        !abierto && (
          <Button
            size="sm"
            onClick={() => {
              setVigencia("");
              setValores(Object.fromEntries((actual?.topes ?? []).map((t) => [t.categoria, String(t.topeAnual)])));
              setAbierto(true);
            }}
          >
            Cargar nuevos topes
          </Button>
        )
      }
    >
      {actual && (
        <p className={`mb-3 text-sm ${edad != null && edad > 7 ? "text-amber-400" : "text-muted-foreground"}`}>
          Vigentes desde {actual.vigencia.split("-").reverse().join("/")}
          {edad != null && edad > 7 ? ` (hace ${edad} meses: probablemente haya topes nuevos)` : ""}.
        </p>
      )}
      {abierto ? (
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm">
            Rigen desde
            <Input type="date" className="w-44" value={vigencia} onChange={(e) => setVigencia(e.target.value)} />
          </label>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {CATEGORIAS.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm">
                <span className="w-5 font-medium">{c}</span>
                <Input inputMode="decimal" aria-label={`Tope anual categoría ${c}`} value={valores[c] ?? ""} onChange={(e) => setValores({ ...valores, [c]: e.target.value })} />
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <Button disabled={!vigencia || guardar.isPending} onClick={() => guardar.mutate()}>
              Guardar topes
            </Button>
            <Button variant="ghost" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Son los ingresos brutos anuales máximos de cada categoría, tal como los publica ARCA.</p>
        </div>
      ) : (
        <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {(actual?.topes ?? []).map((t) => (
            <li key={t.categoria} className="flex justify-between gap-2">
              <span className="font-medium">{t.categoria}</span>
              <span className="tabular-nums">{formatoPesos(t.topeAnual)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

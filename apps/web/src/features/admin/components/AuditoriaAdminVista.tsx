"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BitacoraAuditoria } from "@/components/shared/bitacora-auditoria";
import { useApiFetch } from "@/hooks/use-api";
import { formatoFechaHora, formatoNumero } from "@/lib/formato";
import { useEmpresasAdmin } from "../hooks/use-admin";

interface Verificacion {
  total: number;
  integra: boolean;
  errores: number;
  primerError: string | null;
  ultimoId: string | null;
  ultimoHash: string | null;
  verificadoEn: string;
}

/** Recalcula la cadena de hashes: si alguien tocó la base a mano, se ve acá. */
function Integridad() {
  const api = useApiFetch();
  const { orgId } = useAuth();
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["admin", "auditoria-verificar", orgId],
    queryFn: () => api<Verificacion>("/admin/auditoria/verificar"),
    enabled: Boolean(orgId),
  });
  const ok = data?.integra;
  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${data && !ok ? "border-red-500/50 bg-red-500/10" : ""}`}>
      {data && !ok ? <ShieldAlert className="size-6 text-red-500" aria-hidden /> : <ShieldCheck className="size-6 text-emerald-500" aria-hidden />}
      <div className="min-w-0 flex-1 text-sm">
        {!data ? (
          "Verificando la integridad…"
        ) : ok ? (
          <>
            <b>Bitácora íntegra.</b> {formatoNumero(data.total)} registros encadenados, ninguno fue tocado.
          </>
        ) : (
          <>
            <b>¡Alerta! La bitácora fue alterada.</b> {data.errores} registros no coinciden; el primero es el #{data.primerError}.
          </>
        )}
        {data?.ultimoHash && (
          <span className="block truncate font-mono text-xs text-muted-foreground" title={data.ultimoHash}>
            Último sello #{data.ultimoId}: {data.ultimoHash} · {formatoFechaHora(data.verificadoEn)}
          </span>
        )}
      </div>
      <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
        Verificar de nuevo
      </Button>
    </div>
  );
}

/** Consola → Auditoría: los cambios de todas las empresas. */
export function AuditoriaAdminVista() {
  const empresas = useEmpresasAdmin();
  const [empresaId, setEmpresaId] = useState("");
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Auditoría</h1>
        <p className="text-sm text-muted-foreground">Quién cambió qué y cuándo en todas las empresas. Inalterable y encadenada con hashes (SOC 2 / ISO 27001).</p>
      </div>
      <Integridad />
      <select className="h-8 w-fit rounded-lg border bg-transparent px-2 text-sm" aria-label="Empresa" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
        <option value="">Todas las empresas</option>
        {(empresas.data ?? []).map((e) => (
          <option key={e.id} value={e.id}>
            {e.nombre}
          </option>
        ))}
      </select>
      <BitacoraAuditoria key={empresaId} ruta="/admin/auditoria" empresaId={empresaId || undefined} />
    </div>
  );
}

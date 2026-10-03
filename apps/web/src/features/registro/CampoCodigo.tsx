"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiFetch } from "@/hooks/use-api";
import { CartelBeneficios } from "@/features/planes/components/CartelBeneficios";

export interface CodigoVerificado {
  ok: boolean;
  mensaje?: string;
  codigo?: string;
  camara?: string | null;
  diasPrueba?: number;
  mesGratis?: boolean;
  aviso?: string | null;
  /** Beneficios en palabras, armados por la API desde las reglas del cupón. */
  beneficios?: { lista: string[] };
}

/** Verifica el código medio segundo después de que deja de escribir (GET /registro/codigo). */
export function useVerificarCodigo(valor: string) {
  const api = useApiFetch({ permitirPendiente: true });
  const [codigo, setCodigo] = useState(valor.trim());
  useEffect(() => {
    const t = setTimeout(() => setCodigo(valor.trim()), 500);
    return () => clearTimeout(t);
  }, [valor]);
  const consulta = useQuery({
    queryKey: ["codigo-registro", codigo],
    queryFn: () => api<CodigoVerificado>(`/registro/codigo?codigo=${encodeURIComponent(codigo)}`),
    enabled: Boolean(codigo),
    retry: false,
    staleTime: 60_000,
  });
  const vacio = !valor.trim();
  return {
    resultado: vacio || !codigo ? null : consulta.isError ? { ok: false, mensaje: "No pudimos verificar el código. Probá de nuevo." } : (consulta.data ?? null),
    buscando: !vacio && (valor.trim() !== codigo || consulta.isFetching),
  };
}

/** Código de una cámara o cupón (no importan mayúsculas ni espacios). */
export function CampoCodigo({ valor, onChange, resultado, buscando }: { valor: string; onChange: (v: string) => void; resultado: CodigoVerificado | null; buscando: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="reg-codigo">¿Tenés un código? (opcional)</Label>
      <div className="relative">
        <Input id="reg-codigo" className="uppercase placeholder:normal-case" placeholder="Ej. el de tu cámara" value={valor} onChange={(e) => onChange(e.target.value)} autoComplete="off" />
        {buscando && <Loader2 className="absolute top-2 right-2 size-4 animate-spin text-muted-foreground" aria-hidden />}
      </div>
      {resultado && !buscando && (
        resultado.ok && resultado.codigo ? (
          <div className="flex flex-col gap-1">
            <CartelBeneficios compacto codigo={resultado.codigo} camara={resultado.camara ?? null} beneficios={resultado.beneficios?.lista ?? []} aplicado={false} />
            {resultado.aviso && <p className="text-xs text-amber-600">{resultado.aviso}</p>}
          </div>
        ) : (
          <p role="alert" className="text-xs text-destructive">
            {resultado.mensaje}
          </p>
        )
      )}
    </div>
  );
}

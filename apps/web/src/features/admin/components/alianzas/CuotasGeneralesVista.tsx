"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CargandoFilas, ErrorDatos } from "@/components/shared/estado-datos";
import { useAccionesAlianzas, useCuotasGenerales, type CuotasGeneralesPlan } from "../../hooks/use-alianzas";
import { Panel } from "../comunes";

function FilaPlan({ p }: { p: CuotasGeneralesPlan }) {
  const { editarCuotasGenerales } = useAccionesAlianzas();
  const [v, setV] = useState({ trimestral: p.trimestral, anual: p.anual });
  const cambio = v.trimestral !== p.trimestral || v.anual !== p.anual;
  const numero = (t: string) => Math.min(12, Math.max(1, Number(t) || 1));
  return (
    <TableRow>
      <TableCell className="font-medium">{p.nombre}</TableCell>
      <TableCell>
        <Input className="h-8 w-20" type="number" min={1} max={12} aria-label={`Cuotas del trimestral (${p.nombre})`} value={v.trimestral} onChange={(e) => setV({ ...v, trimestral: numero(e.target.value) })} />
      </TableCell>
      <TableCell>
        <Input className="h-8 w-20" type="number" min={1} max={12} aria-label={`Cuotas del anual (${p.nombre})`} value={v.anual} onChange={(e) => setV({ ...v, anual: numero(e.target.value) })} />
      </TableCell>
      <TableCell className="text-right">
        <Button
          size="sm"
          disabled={!cambio || editarCuotasGenerales.isPending}
          onClick={() => editarCuotasGenerales.mutate({ id: p.id, ...v }, { onSuccess: () => toast.success(`Cuotas del ${p.nombre} guardadas`), onError: (e) => toast.error(e.message) })}
        >
          Guardar
        </Button>
      </TableCell>
    </TableRow>
  );
}

/** Cuotas sin interés para clientes sin código, por plan. Cada cupón puede definir las suyas. */
export function CuotasGeneralesVista() {
  const planes = useCuotasGenerales();
  return (
    <>
      <div>
        <Link href="/admin/alianzas" className="text-sm text-muted-foreground hover:underline">
          ← Alianzas
        </Link>
        <h1 className="text-xl font-semibold">Cuotas sin interés</h1>
        <p className="text-sm text-muted-foreground">
          En cuántas cuotas se pueden pagar el trimestral y el anual (primer período y renovaciones) para quien no tiene código. Los cupones pueden definir las suyas en sus reglas. El mensual siempre va en un pago.
        </p>
      </div>
      <Panel titulo="Por plan">
        {planes.isPending ? (
          <CargandoFilas filas={3} />
        ) : planes.isError ? (
          <ErrorDatos error={planes.error} onReintentar={() => planes.refetch()} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Trimestral</TableHead>
                <TableHead>Anual</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {planes.data.map((p) => (
                <FilaPlan key={`${p.id}-${p.trimestral}-${p.anual}`} p={p} />
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
    </>
  );
}

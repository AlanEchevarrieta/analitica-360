"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { formatoPesos } from "@/lib/formato";
import { linkWhatsApp } from "@/features/clientes/hooks/use-clientes";
import { useProveedor } from "../hooks/use-proveedores";
import { ProveedorForm } from "./ProveedorForm";

const fecha = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

export function ProveedorFichaVista({ id }: { id: string }) {
  const { data, isPending, isError, error, refetch } = useProveedor(id);
  const [editando, setEditando] = useState(false);
  if (isPending) return <CargandoFilas filas={6} />;
  if (isError) return <ErrorDatos error={error} onReintentar={() => refetch()} />;
  const { proveedor: p, compras } = data;
  const total = compras.reduce((a, c) => a + c.total, 0);
  const wa = linkWhatsApp(p.telefono, "Hola! ");
  const dato = (etiqueta: string, valor: string | null) => (valor ? <p><span className="text-muted-foreground">{etiqueta}:</span> {valor}</p> : null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{p.nombre}</h1>
        {!p.activo && <span className="rounded bg-muted px-2 text-xs">Inactivo</span>}
        <div className="ml-auto flex gap-2">
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <MessageCircle aria-hidden /> WhatsApp
            </a>
          )}
          <Button size="sm" variant="outline" onClick={() => setEditando((x) => !x)}>
            {editando ? "Cancelar" : "Editar"}
          </Button>
        </div>
      </div>

      {editando ? (
        <ProveedorForm inicial={p} onHecho={() => setEditando(false)} />
      ) : (
        <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {dato("Vendedor", p.nombreVendedor)}
          {dato("Teléfono", p.telefono)}
          {dato("Email", p.email)}
          {dato("Provee", p.productosQueProvee)}
          {dato("Pago", p.condicionesPago)}
          {dato("Entrega", p.plazoEntrega)}
          {dato("CUIT", p.cuit)}
          {dato("IVA", p.condicionAfip)}
          {dato("Alias", p.aliasCbu)}
          {dato("CBU", p.cbu)}
          {dato("Banco", p.banco)}
          {dato("Notas", p.notas)}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            Compras · {compras.length} por {formatoPesos(total)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {compras.length === 0 ? (
            <SinDatos mensaje="Sin compras a este proveedor." />
          ) : (
            <ul className="flex flex-col divide-y text-sm">
              {compras.map((c) => (
                <li key={c.id} className="flex gap-3 py-2">
                  <span className="w-24 shrink-0 tabular-nums">{fecha(c.fecha)}</span>
                  <span className="flex-1 truncate text-muted-foreground">{c.productos}</span>
                  <span className="font-medium tabular-nums">{formatoPesos(c.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

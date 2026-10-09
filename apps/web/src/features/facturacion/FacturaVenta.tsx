"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { FileText, Mail, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useRol } from "@/hooks/use-rol";
import { formatoFechaHora, formatoPesos } from "@/lib/formato";
import { abrirPdf, useAccionesFacturacion, useComprobantesDeVenta, useFacturacion, type Receptor } from "./use-facturacion";

const selectCls = "h-9 rounded-lg border bg-transparent px-2 text-sm";

/** En la ficha de la venta: emitir la Factura C, verla en PDF, mandarla y anularla con nota de crédito. */
export function FacturaVenta({ ventaId, anulada, telefono }: { ventaId: string; anulada: boolean; telefono?: string | null }) {
  const { data: estado } = useFacturacion();
  const { data: comprobantes } = useComprobantesDeVenta(ventaId);
  const { facturar, notaCredito, enviarEmail } = useAccionesFacturacion();
  const [email, setEmail] = useState<string | null>(null);
  const { getToken } = useAuth();
  const esDueno = useRol() === "dueno";
  const [conCliente, setConCliente] = useState(false);
  const [r, setR] = useState<Receptor>({ docTipo: 96, docNro: "", nombre: "", condicionIva: 5 });

  if (!estado?.disponible) return null;
  const factura = comprobantes?.find((c) => c.tipo === 11);
  const nota = comprobantes?.find((c) => c.tipo === 13);

  const ver = async (id: string) => {
    try {
      await abrirPdf(id, await getToken());
    } catch {
      toast.error("No se pudo abrir el PDF");
    }
  };
  const emitir = () =>
    facturar.mutate(
      { ventaId, receptor: conCliente ? { ...r, nombre: r.nombre?.trim() || null } : null },
      {
        onSuccess: (c) => toast.success(`${c.nombre} ${c.numero} emitida (CAE ${c.cae})`),
        onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo facturar", { duration: 15_000 }),
      },
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="size-4" /> Factura electrónica
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {!estado.config?.verificadoEn ? (
          <p className="text-muted-foreground">
            Para facturar, completá y verificá tus datos en{" "}
            <Link href="/configuracion" className="text-primary hover:underline">
              Configuración → Factura electrónica
            </Link>
            .
          </p>
        ) : factura ? (
          <>
            <p>
              <span className="font-medium">
                {factura.nombre} {factura.numero}
              </span>{" "}
              · {formatoPesos(factura.total)} · CAE {factura.cae}
              {factura.prueba && <span className="ml-1 text-xs text-amber-600">(prueba)</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => void ver(factura.id)}>
                Ver PDF
              </Button>
              {telefono && (
                <a
                  className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
                  href={`https://wa.me/${telefono.replace(/\D/g, "").replace(/^(\d{10})$/, "549$1")}?text=${encodeURIComponent(`Hola, te mando tu ${factura.nombre} ${factura.numero} por ${formatoPesos(factura.total)}.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="size-4" /> Avisar por WhatsApp
                </a>
              )}
              {esDueno && !nota && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={notaCredito.isPending}
                  onClick={() => {
                    if (window.confirm("¿Emitir una nota de crédito que anula esta factura? Se informa a ARCA y no se puede deshacer."))
                      notaCredito.mutate(factura.id, { onSuccess: (c) => toast.success(`${c.nombre} ${c.numero} emitida`), onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo emitir") });
                  }}
                >
                  Anular con nota de crédito
                </Button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="email"
                aria-label="Email del cliente"
                placeholder="email del cliente"
                className="h-8 max-w-64"
                value={email ?? factura.emailCliente ?? ""}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={enviarEmail.isPending}
                onClick={() =>
                  enviarEmail.mutate(
                    { id: factura.id, email: (email ?? factura.emailCliente ?? "").trim() || null },
                    { onSuccess: (c) => toast.success(`Enviada a ${c.enviadoA}`), onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo mandar", { duration: 12_000 }) },
                  )
                }
              >
                <Mail className="size-4" /> {enviarEmail.isPending ? "Mandando…" : "Mandar por email"}
              </Button>
              {factura.enviadoA && factura.enviadoEn && (
                <span className="text-xs text-muted-foreground">
                  Enviada a {factura.enviadoA} el {formatoFechaHora(factura.enviadoEn)}
                </span>
              )}
            </div>
            {nota && (
              <p className="text-muted-foreground">
                Anulada con la {nota.nombre} {nota.numero}.{" "}
                <button type="button" className="text-primary hover:underline" onClick={() => void ver(nota.id)}>
                  Ver PDF
                </button>
              </p>
            )}
          </>
        ) : anulada ? (
          <p className="text-muted-foreground">La venta está anulada: no se puede facturar.</p>
        ) : (
          <>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={conCliente} onChange={(e) => setConCliente(e.target.checked)} /> Identificar al cliente (DNI o CUIT)
            </label>
            {conCliente && (
              <div className="grid gap-2 sm:grid-cols-2">
                <select className={selectCls} aria-label="Tipo de documento" value={r.docTipo} onChange={(e) => setR({ ...r, docTipo: Number(e.target.value) as Receptor["docTipo"] })}>
                  <option value={96}>DNI</option>
                  <option value={80}>CUIT</option>
                </select>
                <Input aria-label="Número de documento" inputMode="numeric" placeholder={r.docTipo === 80 ? "20-12345678-6" : "12345678"} value={r.docNro} onChange={(e) => setR({ ...r, docNro: e.target.value })} />
                <Input aria-label="Nombre o razón social" placeholder="Nombre o razón social" value={r.nombre ?? ""} onChange={(e) => setR({ ...r, nombre: e.target.value })} />
                <select className={selectCls} aria-label="Condición frente al IVA" value={r.condicionIva} onChange={(e) => setR({ ...r, condicionIva: Number(e.target.value) as Receptor["condicionIva"] })}>
                  <option value={5}>Consumidor final</option>
                  <option value={6}>Monotributista</option>
                  <option value={1}>Responsable inscripto</option>
                  <option value={4}>Exento</option>
                </select>
              </div>
            )}
            <Button onClick={emitir} disabled={facturar.isPending}>
              {facturar.isPending ? "Pidiendo el CAE a ARCA…" : "Emitir Factura C"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

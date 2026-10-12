"use client";

import { useState, useSyncExternalStore } from "react";
import { useAuth } from "@clerk/nextjs";
import { Download, Mail, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pdfDocumento, useAccionesDocumentos, type TipoDocumento } from "./use-documentos";

const mensajeError = (e: unknown, porDefecto: string) => (e instanceof Error ? e.message : porDefecto);

/** ¿El navegador puede compartir un PDF (celular)? Así se manda el archivo y no solo un link. */
function puedeCompartirArchivos() {
  try {
    return Boolean(navigator.canShare?.({ files: [new File([""], "x.pdf", { type: "application/pdf" })] }));
  } catch {
    return false;
  }
}
const sinSuscripcion = () => () => {};
const usePuedeCompartirArchivos = () => useSyncExternalStore(sinSuscripcion, puedeCompartirArchivos, () => false);

/**
 * Descargar, mandar por WhatsApp (link al PDF), compartir el archivo (celular) y
 * mandar por email. Sirve para el comprobante de venta, el recibo y el presupuesto.
 */
export function DocumentoAcciones({ tipo, id, nombre, emailCliente, conEmail = true }: { tipo: TipoDocumento; id: string; nombre: string; emailCliente?: string | null; conEmail?: boolean }) {
  const aQuien = tipo === "orden_compra" ? "del proveedor" : "del cliente";
  const { getToken } = useAuth();
  const { link, email } = useAccionesDocumentos();
  const [para, setPara] = useState<string | null>(null);
  const [bajando, setBajando] = useState(false);
  const compartible = usePuedeCompartirArchivos();

  const bajar = async () => {
    setBajando(true);
    try {
      return await pdfDocumento(tipo, id, await getToken());
    } finally {
      setBajando(false);
    }
  };

  const ver = async () => {
    // La pestaña se abre antes de esperar a la API: si no, el navegador la bloquea.
    const ventana = window.open("", "_blank");
    try {
      const url = URL.createObjectURL(await bajar());
      if (ventana) ventana.location.href = url;
      else window.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      ventana?.close();
      toast.error(mensajeError(e, "No se pudo generar el PDF"));
    }
  };

  const whatsapp = () => {
    const ventana = window.open("", "_blank");
    link.mutate(
      { tipo, id },
      {
        onSuccess: (l) => {
          if (ventana) ventana.location.href = l.whatsapp;
          else window.location.href = l.whatsapp;
          if (!l.telefono) toast.info(`No hay teléfono ${aQuien} cargado: elegí el contacto en WhatsApp`);
        },
        onError: (e) => {
          ventana?.close();
          toast.error(mensajeError(e, "No se pudo preparar el link"));
        },
      },
    );
  };

  const compartir = async () => {
    try {
      const archivo = new File([await bajar()], `${nombre.replace(/[^\w-]/g, "")}.pdf`, { type: "application/pdf" });
      await navigator.share({ files: [archivo], title: nombre });
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") toast.error(mensajeError(e, "No se pudo compartir"));
    }
  };

  const mandar = () =>
    email.mutate(
      { tipo, id, email: (para ?? emailCliente ?? "").trim() || null },
      { onSuccess: (r) => toast.success(`Enviado a ${r.para}`), onError: (e) => toast.error(mensajeError(e, "No se pudo mandar"), { duration: 12_000 }) },
    );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={bajando} onClick={() => void ver()}>
          <Download className="size-4" /> {bajando ? "Generando…" : "Ver PDF"}
        </Button>
        <Button size="sm" variant="outline" disabled={link.isPending} onClick={whatsapp}>
          <MessageCircle className="size-4" /> WhatsApp
        </Button>
        {compartible && (
          <Button size="sm" variant="outline" disabled={bajando} onClick={() => void compartir()}>
            <Share2 className="size-4" /> Compartir PDF
          </Button>
        )}
      </div>
      {conEmail && (
        <div className="flex flex-wrap items-center gap-2">
          <Input type="email" aria-label={`Email para mandar ${nombre}`} placeholder={`email ${aQuien}`}
            title="Si lo dejás vacío, se usa el email que tiene cargado" className="h-8 max-w-64" value={para ?? emailCliente ?? ""} onChange={(e) => setPara(e.target.value)} />
          <Button size="sm" variant="outline" disabled={email.isPending} onClick={mandar}>
            <Mail className="size-4" /> {email.isPending ? "Mandando…" : "Mandar por email"}
          </Button>
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { formatoARS } from "@/lib/productos";
import { useSitio } from "@/lib/sitio-contexto";
import { urlWhatsApp } from "@/lib/whatsapp";

const sinSuscripcion = () => () => {};

function leerUltimoPedido() {
  try {
    return sessionStorage.getItem("tienda-ultimo-pedido");
  } catch {
    return null;
  }
}

function parsearUltimoPedido(raw: string | null): { n?: string; wa?: string; total?: number } {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as { n?: string; wa?: string; total?: number };
  } catch {
    return {};
  }
}

export function ConfirmacionPedido() {
  const sitio = useSitio();
  const params = useSearchParams();
  const nParam = params.get("n") ?? "";
  const raw = useSyncExternalStore(sinSuscripcion, leerUltimoPedido, () => null);
  const ultimo = parsearUltimoPedido(raw);
  const n = ultimo.n || nParam;
  const wa = urlWhatsApp(sitio.whatsapp, ultimo.wa || `Hola! Quiero consultar el pedido ${n}`);
  const hayTransferencia = Boolean(sitio.alias || sitio.cbu);
  const [copiado, setCopiado] = useState<string | null>(null);
  const copiar = (texto: string) => {
    void navigator.clipboard?.writeText(texto).then(() => setCopiado(texto));
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <p className="text-6xl" aria-hidden>
        ✅
      </p>
      <h1 className="mt-4 font-serif text-3xl text-[var(--tinta)]">¡Pedido enviado!</h1>
      {n ? <p className="mt-3 font-semibold text-[var(--marca-oscuro)]">N° de pedido: {n}</p> : null}
      <p className="mt-2 text-[var(--tinta)]/75">{sitio.nombre} te va a contactar para coordinar el pago y el envío.</p>

      {hayTransferencia ? (
        <div className="mt-8 rounded-2xl border border-[var(--marca-oscuro)]/15 bg-white p-5 text-left text-sm">
          <p className="font-semibold">Si querés, ya podés transferir{ultimo.total ? ` ${formatoARS(ultimo.total)}` : ""}:</p>
          <dl className="mt-3 space-y-2">
            {sitio.alias ? (
              <div className="flex items-center justify-between gap-2">
                <dt className="text-[var(--tinta)]/60">Alias</dt>
                <dd className="flex items-center gap-2 font-medium">
                  {sitio.alias}
                  <button type="button" onClick={() => copiar(sitio.alias!)} className="rounded-full border px-2 py-0.5 text-xs">
                    {copiado === sitio.alias ? "¡Copiado!" : "Copiar"}
                  </button>
                </dd>
              </div>
            ) : null}
            {sitio.cbu ? (
              <div className="flex items-center justify-between gap-2">
                <dt className="text-[var(--tinta)]/60">CBU/CVU</dt>
                <dd className="flex items-center gap-2 font-medium tabular-nums">
                  {sitio.cbu}
                  <button type="button" onClick={() => copiar(sitio.cbu!)} className="rounded-full border px-2 py-0.5 text-xs">
                    {copiado === sitio.cbu ? "¡Copiado!" : "Copiar"}
                  </button>
                </dd>
              </div>
            ) : null}
            {sitio.titular ? (
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--tinta)]/60">Titular</dt>
                <dd className="font-medium">{sitio.titular}</dd>
              </div>
            ) : null}
          </dl>
          <p className="mt-3 text-xs text-[var(--tinta)]/60">Mandá el comprobante por WhatsApp con tu número de pedido.</p>
        </div>
      ) : null}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link href="/productos" className="rounded-[var(--r-boton)] bg-[var(--marca-oscuro)] px-6 py-3 text-sm font-semibold text-white">
          Seguir comprando
        </Link>
        {wa ? (
          <a href={wa} target="_blank" rel="noreferrer" className="rounded-[var(--r-boton)] border border-[var(--marca-hero)] px-6 py-3 text-sm font-semibold text-[var(--marca-hero)]">
            Escribir por WhatsApp
          </a>
        ) : null}
      </div>
    </div>
  );
}

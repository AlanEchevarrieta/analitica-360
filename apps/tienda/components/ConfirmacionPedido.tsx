"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { pagarConMercadoPago } from "@/app/checkout/actions";
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

function parsearUltimoPedido(raw: string | null): { n?: string; wa?: string; total?: number; id?: string; mp?: boolean } {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as { n?: string; wa?: string; total?: number; id?: string; mp?: boolean };
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
  // Vuelta de Mercado Pago: agrega ?status=approved|pending|rejected|null (o collection_status) e id del pedido.
  const pedidoId = params.get("id") || params.get("external_reference") || ultimo.id || "";
  const conMp = Boolean(params.get("id") || params.get("external_reference") || ultimo.mp);
  const estadoMp = params.get("status") || params.get("collection_status") || (conMp ? "sin_pagar" : "");
  const [abriendo, setAbriendo] = useState(false);
  const [errorPago, setErrorPago] = useState<string | null>(null);
  const reintentar = async () => {
    setAbriendo(true);
    setErrorPago(null);
    const r = await pagarConMercadoPago(pedidoId);
    if (!r.ok) {
      setAbriendo(false);
      setErrorPago(r.error);
    } else if (r.url) window.location.assign(r.url);
    else window.location.reload(); // ya estaba pagado
  };
  if (conMp) {
    const aprobado = estadoMp === "approved";
    const pendiente = estadoMp === "pending" || estadoMp === "in_process";
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-6xl" aria-hidden>
          {aprobado ? "✅" : pendiente ? "⏳" : "💳"}
        </p>
        <h1 className="mt-4 font-serif text-3xl text-[var(--tinta)]">{aprobado ? "¡Pago aprobado!" : pendiente ? "Tu pago está en proceso" : "Falta pagar tu pedido"}</h1>
        {n ? <p className="mt-3 font-semibold text-[var(--marca-oscuro)]">N° de pedido: {n}</p> : null}
        <p className="mt-2 text-[var(--tinta)]/75">
          {aprobado
            ? `${sitio.nombre} ya recibió tu pago y va a preparar el pedido.`
            : pendiente
              ? "Mercado Pago nos avisa apenas se acredite. No hace falta que pagues de nuevo."
              : "El pedido quedó guardado, pero el pago no se completó. Podés intentarlo de nuevo."}
        </p>
        {!aprobado && !pendiente && pedidoId ? (
          <button
            type="button"
            onClick={() => void reintentar()}
            disabled={abriendo}
            className="mt-6 rounded-[var(--r-boton)] bg-[var(--marca-hero)] px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {abriendo ? "Abriendo Mercado Pago…" : "Pagar con Mercado Pago"}
          </button>
        ) : null}
        {errorPago ? <p className="mt-3 text-sm text-red-700">{errorPago}</p> : null}
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

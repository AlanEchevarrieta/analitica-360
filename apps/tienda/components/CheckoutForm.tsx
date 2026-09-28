"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCarrito } from "@/lib/carrito";
import { formatoARS } from "@/lib/productos";
import { mensajeWhatsAppPedido, PROVINCIAS_AR, type DatosEnvio } from "@/lib/pedidos";
import { useSitio } from "@/lib/sitio-contexto";
import { urlWhatsApp } from "@/lib/whatsapp";
import { crearPedidoTienda } from "@/app/checkout/actions";

const vacio: DatosEnvio = {
  nombre: "",
  email: "",
  telefono: "",
  calle: "",
  numero: "",
  piso: "",
  ciudad: "",
  provincia: "Mendoza",
  codigoPostal: "",
  notas: "",
};

export function CheckoutForm() {
  const router = useRouter();
  const { items, total, vaciar } = useCarrito();
  const sitio = useSitio();
  const [form, setForm] = useState<DatosEnvio>(vacio);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function set<K extends keyof DatosEnvio>(key: K, value: DatosEnvio[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) {
      setError("El carrito está vacío");
      return;
    }
    setEnviando(true);
    setError(null);
    const res = await crearPedidoTienda({
      envio: form,
      items: items.map((i) => ({
        productoId: i.productoId,
        varianteId: i.varianteId,
        cantidad: i.cantidad,
      })),
    });
    if (!res.ok) {
      setEnviando(false);
      setError(res.error);
      return;
    }
    const msg = mensajeWhatsAppPedido({
      numeroPedido: res.numeroPedido,
      envio: form,
      items: items.map((i) => ({
        nombre: i.nombre,
        varianteEtiqueta: i.varianteEtiqueta,
        cantidad: i.cantidad,
        precio: i.precio,
      })),
      // Total calculado por la API con los precios vigentes.
      total: res.total,
    });
    vaciar();
    try {
      sessionStorage.setItem(
        "tienda-ultimo-pedido",
        JSON.stringify({ n: res.numeroPedido, wa: msg, total: res.total }),
      );
    } catch {
      /* ignore */
    }
    const wa = urlWhatsApp(sitio.whatsapp, msg);
    if (wa) window.open(wa, "_blank", "noopener,noreferrer");
    router.push(`/pedido-confirmado?n=${encodeURIComponent(res.numeroPedido)}`);
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="font-serif text-3xl">No hay productos para checkout</h1>
        <Link href="/productos" className="mt-6 inline-block text-[var(--marca)] underline">
          Volver al catálogo
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1fr_320px]">
      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-[var(--marca-oscuro)]/10 bg-white p-5">
        <h1 className="font-serif text-3xl">Checkout</h1>
        <Campo label="Nombre completo" required value={form.nombre} onChange={(v) => set("nombre", v)} />
        <Campo label="Email" type="email" required value={form.email} onChange={(v) => set("email", v)} />
        <Campo label="Teléfono" required value={form.telefono} onChange={(v) => set("telefono", v)} />
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Campo label="Calle" required value={form.calle} onChange={(v) => set("calle", v)} />
          </div>
          <Campo label="Número" required value={form.numero} onChange={(v) => set("numero", v)} />
        </div>
        <Campo label="Piso / depto (opcional)" value={form.piso} onChange={(v) => set("piso", v)} />
        <Campo label="Ciudad" required value={form.ciudad} onChange={(v) => set("ciudad", v)} />
        <label className="block text-sm">
          Provincia
          <select
            required
            className="mt-1 w-full rounded-xl border border-[var(--marca-oscuro)]/20 px-3 py-2"
            value={form.provincia}
            onChange={(e) => set("provincia", e.target.value)}
          >
            {PROVINCIAS_AR.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <Campo label="Código postal" required value={form.codigoPostal} onChange={(v) => set("codigoPostal", v)} />
        <label className="block text-sm">
          Notas (opcional)
          <textarea
            className="mt-1 w-full rounded-xl border border-[var(--marca-oscuro)]/20 px-3 py-2"
            rows={3}
            value={form.notas}
            onChange={(e) => set("notas", e.target.value)}
          />
        </label>
        {error ? <p className="text-sm text-[var(--marca)]">{error}</p> : null}
        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-[var(--r-boton)] bg-[var(--marca-hero)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--marca-oscuro)] disabled:opacity-60"
        >
          {enviando ? "Confirmando…" : "Confirmar pedido por WhatsApp"}
        </button>
      </form>

      <aside className="h-fit rounded-2xl border border-[var(--marca-oscuro)]/10 bg-white p-5">
        <h2 className="font-serif text-xl">Resumen</h2>
        <ul className="mt-4 space-y-3 text-sm">
          {items.map((i) => (
            <li key={`${i.productoId}-${i.varianteId ?? "base"}`} className="flex justify-between gap-3">
              <span>
                {i.cantidad}× {i.nombre}
                {i.varianteEtiqueta ? ` (${i.varianteEtiqueta})` : ""}
              </span>
              <span className="shrink-0">{formatoARS(i.cantidad * i.precio)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-[var(--marca-oscuro)]/10 pt-3 font-semibold">Total {formatoARS(total)}</p>
      </aside>
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block text-sm">
      {label}
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-[var(--marca-oscuro)]/20 px-3 py-2"
      />
    </label>
  );
}

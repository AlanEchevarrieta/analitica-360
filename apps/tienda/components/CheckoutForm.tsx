"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCarrito } from "@/lib/carrito";
import { formatoARS } from "@/lib/productos";
import { mensajeWhatsAppPedido, PROVINCIAS_AR, type DatosEnvio } from "@/lib/pedidos";
import { useSitio } from "@/lib/sitio-contexto";
import { urlWhatsApp } from "@/lib/whatsapp";
import { crearPedidoTienda, validarCupon, type FormaPago } from "@/app/checkout/actions";
import { AvisoMinimo } from "@/components/AvisoMinimo";

const vacio: DatosEnvio = {
  nombre: "",
  email: "",
  telefono: "",
  calle: "",
  numero: "",
  piso: "",
  ciudad: "",
  provincia: "",
  codigoPostal: "",
  notas: "",
};

const campo = "mt-1 w-full rounded-xl border border-[var(--marca-oscuro)]/20 px-3 py-2";

type CuentaCheckout = {
  email: string;
  nombre: string | null;
  telefono: string | null;
  calle: string | null;
  numero: string | null;
  piso: string | null;
  ciudad: string | null;
  provincia: string | null;
  codigoPostal: string | null;
} | null;

export function CheckoutForm({ cuenta }: { cuenta: CuentaCheckout }) {
  const router = useRouter();
  const { items, total, vaciar } = useCarrito();
  const sitio = useSitio();
  const descuentoTransferencia = sitio.descuentoTransferencia ?? 0;
  // Con cuenta, los datos ya vienen completos.
  const [form, setForm] = useState<DatosEnvio>(() =>
    cuenta
      ? {
          ...vacio,
          nombre: cuenta.nombre ?? "",
          email: cuenta.email,
          telefono: cuenta.telefono ?? "",
          calle: cuenta.calle ?? "",
          numero: cuenta.numero ?? "",
          piso: cuenta.piso ?? "",
          ciudad: cuenta.ciudad ?? "",
          provincia: cuenta.provincia ?? "",
          codigoPostal: cuenta.codigoPostal ?? "",
        }
      : vacio,
  );
  const [guardar, setGuardar] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [formaPago, setFormaPago] = useState<FormaPago>(descuentoTransferencia > 0 ? "transferencia" : "a_coordinar");
  const [codigo, setCodigo] = useState("");
  const [cupon, setCupon] = useState<{ codigo: string; descuento: number } | null>(null);
  const [errorCupon, setErrorCupon] = useState<string | null>(null);
  const [validando, setValidando] = useState(false);

  // Mismo cálculo que el servidor (el pedido lo recalcula): cupón sobre el subtotal y transferencia sobre lo que queda.
  const descuentoCupon = cupon ? Math.min(cupon.descuento, total) : 0;
  const trasCupon = total - descuentoCupon;
  const descTransf = formaPago === "transferencia" && descuentoTransferencia > 0 ? Math.round((trasCupon * descuentoTransferencia) / 100) : 0;
  const totalFinal = trasCupon - descTransf;

  async function aplicarCupon() {
    setValidando(true);
    setErrorCupon(null);
    const r = await validarCupon(codigo, total);
    setValidando(false);
    if (r.valido) setCupon({ codigo: r.codigo, descuento: r.descuento });
    else {
      setCupon(null);
      setErrorCupon(r.mensaje);
    }
  }

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
      items: items.map((i) => ({ productoId: i.productoId, varianteId: i.varianteId, cantidad: i.cantidad })),
      cuponCodigo: cupon?.codigo ?? null,
      formaPago,
      guardarDatos: Boolean(cuenta) && guardar,
    });
    if (!res.ok) {
      setEnviando(false);
      setError(res.error);
      return;
    }
    const msg = mensajeWhatsAppPedido({
      numeroPedido: res.numeroPedido,
      envio: form,
      items: items.map((i) => ({ nombre: i.nombre, varianteEtiqueta: i.varianteEtiqueta, cantidad: i.cantidad, precio: i.precio })),
      // Totales calculados por la API con los precios y descuentos vigentes.
      total: res.total,
      cupon: res.descuentoCupon > 0 && cupon ? { codigo: cupon.codigo, descuento: res.descuentoCupon } : null,
      descuentoTransferencia: res.descuentoTransferencia,
      formaPago,
    });
    vaciar();
    try {
      sessionStorage.setItem("tienda-ultimo-pedido", JSON.stringify({ n: res.numeroPedido, wa: msg, total: res.total }));
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
        <h1 className="font-serif text-3xl">No hay productos en el carrito</h1>
        <Link href="/productos" className="mt-6 inline-block text-[var(--marca)] underline">
          Volver al catálogo
        </Link>
      </div>
    );
  }

  const opcionPago = (activa: boolean) =>
    `flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${activa ? "border-[var(--marca)] bg-[var(--marca)]/5" : "border-[var(--marca-oscuro)]/15"}`;

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1fr_340px]">
      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-[var(--marca-oscuro)]/10 bg-white p-5">
        <div>
          <h1 className="font-serif text-3xl">Finalizar pedido</h1>
          {cuenta ? (
            <p className="mt-1 text-sm text-[var(--tinta)]/65">Comprás como {cuenta.email}. El pedido va a aparecer en Mi cuenta.</p>
          ) : (
            <p className="mt-1 text-sm text-[var(--tinta)]/65">
              ¿Ya compraste?{" "}
              <Link href="/ingresar?volver=/checkout" className="font-medium text-[var(--marca)] underline">
                Ingresá
              </Link>{" "}
              y completamos tus datos. También podés seguir sin cuenta.
            </p>
          )}
        </div>
        <Campo label="Nombre completo" required value={form.nombre} onChange={(v) => set("nombre", v)} />
        {cuenta ? null : <Campo label="Email" type="email" required value={form.email} onChange={(v) => set("email", v)} />}
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
          <select required className={campo} value={form.provincia} onChange={(e) => set("provincia", e.target.value)}>
            <option value="">Elegí…</option>
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
          <textarea className={campo} rows={3} value={form.notas} onChange={(e) => set("notas", e.target.value)} />
        </label>
        {cuenta ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={guardar} onChange={(e) => setGuardar(e.target.checked)} className="size-4 accent-[var(--marca)]" />
            Guardar estos datos para la próxima compra
          </label>
        ) : null}

        <fieldset className="space-y-2 border-t border-[var(--marca-oscuro)]/10 pt-4">
          <legend className="mb-2 text-sm font-medium">Forma de pago</legend>
          <label className={opcionPago(formaPago === "transferencia")}>
            <input type="radio" name="pago" className="mt-1 accent-[var(--marca)]" checked={formaPago === "transferencia"} onChange={() => setFormaPago("transferencia")} />
            <span>
              <span className="block text-sm font-medium">
                Transferencia bancaria
                {descuentoTransferencia > 0 ? <span className="ml-2 rounded-full bg-[var(--marca)] px-2 py-0.5 text-xs font-semibold text-white">−{descuentoTransferencia}%</span> : null}
              </span>
              <span className="text-sm text-[var(--tinta)]/60">Te pasamos los datos al confirmar.</span>
            </span>
          </label>
          <label className={opcionPago(formaPago === "a_coordinar")}>
            <input type="radio" name="pago" className="mt-1 accent-[var(--marca)]" checked={formaPago === "a_coordinar"} onChange={() => setFormaPago("a_coordinar")} />
            <span>
              <span className="block text-sm font-medium">Acordar por WhatsApp</span>
              <span className="text-sm text-[var(--tinta)]/60">Efectivo, tarjeta u otro medio: lo coordinamos con vos.</span>
            </span>
          </label>
        </fieldset>

        <AvisoMinimo total={total} />
        {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-[var(--r-boton)] bg-[var(--marca-hero)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--marca-oscuro)] disabled:opacity-60"
        >
          {enviando ? "Confirmando…" : "Confirmar pedido por WhatsApp"}
        </button>
      </form>

      <aside className="h-fit rounded-2xl border border-[var(--marca-oscuro)]/10 bg-white p-5 lg:sticky lg:top-24">
        <h2 className="font-serif text-xl">Resumen</h2>
        <ul className="mt-4 space-y-3 text-sm">
          {items.map((i) => (
            <li key={`${i.productoId}-${i.varianteId ?? "base"}`} className="flex justify-between gap-3">
              <span>
                {i.cantidad}× {i.nombre}
                {i.varianteEtiqueta ? ` (${i.varianteEtiqueta})` : ""}
              </span>
              <span className="shrink-0 tabular-nums">{formatoARS(i.cantidad * i.precio)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-4 border-t border-[var(--marca-oscuro)]/10 pt-3">
          {cupon ? (
            <p className="flex items-center justify-between gap-3 text-sm">
              <span>
                Cupón <b className="font-mono">{cupon.codigo}</b> aplicado
              </span>
              <button type="button" onClick={() => setCupon(null)} className="text-[var(--tinta)]/55 hover:text-[var(--marca)]">
                Quitar
              </button>
            </p>
          ) : (
            <div>
              <div className="flex gap-2">
                <input
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void aplicarCupon();
                    }
                  }}
                  placeholder="Código de descuento"
                  aria-label="Código de descuento"
                  maxLength={40}
                  className="min-w-0 flex-1 rounded-xl border border-[var(--marca-oscuro)]/20 px-3 py-2 font-mono text-sm uppercase"
                />
                <button
                  type="button"
                  onClick={() => void aplicarCupon()}
                  disabled={validando || !codigo.trim()}
                  className="rounded-[var(--r-boton)] border border-[var(--marca-oscuro)]/20 px-3 py-2 text-sm font-medium hover:border-[var(--marca)] disabled:opacity-40"
                >
                  {validando ? "…" : "Aplicar"}
                </button>
              </div>
              {errorCupon ? <p className="mt-2 text-xs text-red-700">{errorCupon}</p> : null}
            </div>
          )}
        </div>

        <dl className="mt-3 space-y-1 border-t border-[var(--marca-oscuro)]/10 pt-3 text-sm">
          {cupon || descTransf ? (
            <div className="flex justify-between text-[var(--tinta)]/65">
              <dt>Subtotal</dt>
              <dd className="tabular-nums">{formatoARS(total)}</dd>
            </div>
          ) : null}
          {cupon ? (
            <div className="flex justify-between text-[var(--marca)]">
              <dt>Cupón {cupon.codigo}</dt>
              <dd className="tabular-nums">−{formatoARS(descuentoCupon)}</dd>
            </div>
          ) : null}
          {descTransf ? (
            <div className="flex justify-between text-[var(--marca)]">
              <dt>Transferencia −{descuentoTransferencia}%</dt>
              <dd className="tabular-nums">−{formatoARS(descTransf)}</dd>
            </div>
          ) : null}
          <div className="flex items-baseline justify-between pt-1 font-semibold">
            <dt>Total</dt>
            <dd className="text-lg tabular-nums">{formatoARS(totalFinal)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs leading-5 text-[var(--tinta)]/55">Al confirmar te abrimos WhatsApp con el detalle para coordinar el pago y el envío.</p>
      </aside>
    </div>
  );
}

function Campo({ label, value, onChange, required, type = "text" }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string }) {
  return (
    <label className="block text-sm">
      {label}
      <input type={type} required={required} value={value} onChange={(e) => onChange(e.target.value)} className={campo} />
    </label>
  );
}

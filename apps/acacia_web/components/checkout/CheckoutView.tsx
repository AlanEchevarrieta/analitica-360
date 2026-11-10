"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCarrito } from "@/lib/carrito";
import { formatoARS } from "@/lib/utils";
import { crearPedidoApi } from "@/lib/api";
import type { MetodoPago, SitioConfig } from "@/lib/types";
import { ArrowLeft, Lock, ShieldCheck } from "lucide-react";
import Link from "next/link";

const PROVINCIAS_AR = [
  "Mendoza",
  "Buenos Aires",
  "CABA",
  "Córdoba",
  "Santa Fe",
  "San Juan",
  "San Luis",
  "Neuquén",
  "Río Negro",
  "Salta",
  "Tucumán",
  "Entre Ríos",
  "Corrientes",
  "Misiones",
  "Chubut",
  "Santa Cruz",
  "Tierra del Fuego",
  "La Pampa",
  "Chaco",
  "Formosa",
  "Jujuy",
  "Catamarca",
  "La Rioja",
  "Santiago del Estero",
];

export function CheckoutView({ config }: { config: SitioConfig }) {
  const router = useRouter();
  const { items, subtotal, vaciar } = useCarrito();

  const [form, setForm] = useState({
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
  });

  const [metodoPago, setMetodoPago] = useState<MetodoPago>("transferencia");
  const [enviando, setEnviando] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (items.length === 0) {
    return (
      <div className="py-24 text-center space-y-6 max-w-xl mx-auto px-4">
        <span className="font-mono-spec text-[10px] uppercase tracking-[0.3em] text-[#6B6D69]">
          [ BOLSA VACÍA ]
        </span>
        <h1 className="font-editorial text-4xl text-[#1C1D1F]">
          No hay piezas seleccionadas
        </h1>
        <p className="text-xs font-mono-spec text-[#6B6D69] tracking-wider">
          Agregá un mate imperial o accesorio artesanal para continuar.
        </p>
        <Link
          href="/catalogo"
          className="inline-block px-8 py-4 bg-[#1C1D1F] text-[#F7F6F2] font-mono-spec text-xs uppercase tracking-widest hover:bg-[#8A5A2B] transition-colors"
        >
          Ir al Catálogo
        </Link>
      </div>
    );
  }

  const descTransferencia = metodoPago === "transferencia" ? Math.round(subtotal * 0.1) : 0;
  const total = subtotal - descTransferencia;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre || !form.telefono || !form.calle || !form.numero || !form.ciudad) {
      setErrorMsg("Por favor completá los campos obligatorios de entrega.");
      return;
    }

    setEnviando(true);
    setErrorMsg("");

    try {
      const res = await crearPedidoApi({
        empresaId: config.empresaId,
        datosEnvio: form,
        metodoPago,
        items: items.map((it) => ({
          productoId: it.productoId,
          varianteId: it.varianteId,
          cantidad: it.cantidad,
          precioUnitario: it.precio,
          nombre: it.nombre,
        })),
      });

      if (res.ok && res.numeroPedido) {
        vaciar();
        const queryParams = new URLSearchParams({
          numero: res.numeroPedido,
          total: String(res.total || total),
          metodo: metodoPago,
          cliente: form.nombre,
        });
        if (res.pagoUrl) {
          queryParams.set("pagoUrl", res.pagoUrl);
        }
        router.push(`/pedido-confirmado?${queryParams.toString()}`);
      } else {
        setErrorMsg(res.error || "Ocurrió un error al procesar tu pedido. Por favor reintentá.");
      }
    } catch {
      setErrorMsg("No se pudo conectar con el servidor. Revisá tu conexión.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-16">
      <Link
        href="/catalogo"
        className="inline-flex items-center text-xs font-mono-spec text-[#6B6D69] hover:text-[#1C1D1F] uppercase tracking-wider mb-8"
      >
        <ArrowLeft size={14} className="mr-2" />
        Seguir explorando
      </Link>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
        {/* Columna Izquierda: Formulario (7 cols) */}
        <div className="lg:col-span-7 space-y-10">
          <div>
            <span className="font-mono-spec text-[10px] uppercase tracking-[0.3em] text-[#D9532F] block mb-2">
              [ PASO FINAL &middot; CHECKOUT SEGURO ]
            </span>
            <h1 className="font-editorial text-3xl sm:text-4xl text-[#1C1D1F]">
              Datos de Despacho &amp; Entrega
            </h1>
          </div>

          {errorMsg && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-800 text-xs font-mono-spec">
              {errorMsg}
            </div>
          )}

          {/* Contacto */}
          <div className="space-y-4 font-mono-spec text-xs">
            <span className="text-[11px] uppercase tracking-wider text-[#6B6D69] block">
              1. Contacto del Destinatario
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase text-[#1C1D1F] mb-1">Nombre y Apellido *</label>
                <input
                  type="text"
                  required
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Juan Pérez"
                  className="w-full p-3 bg-white border border-[#1C1D1F]/20 text-[#1C1D1F] text-xs focus:border-[#1C1D1F] outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase text-[#1C1D1F] mb-1">WhatsApp / Teléfono *</label>
                <input
                  type="tel"
                  required
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  placeholder="261 555 1234"
                  className="w-full p-3 bg-white border border-[#1C1D1F]/20 text-[#1C1D1F] text-xs focus:border-[#1C1D1F] outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[10px] uppercase text-[#1C1D1F] mb-1">Email (Confirmación y Factura)</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="juan@email.com"
                  className="w-full p-3 bg-white border border-[#1C1D1F]/20 text-[#1C1D1F] text-xs focus:border-[#1C1D1F] outline-none"
                />
              </div>
            </div>
          </div>

          {/* Domicilio */}
          <div className="space-y-4 font-mono-spec text-xs">
            <span className="text-[11px] uppercase tracking-wider text-[#6B6D69] block">
              2. Domicilio de Envío
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-[10px] uppercase text-[#1C1D1F] mb-1">Calle *</label>
                <input
                  type="text"
                  required
                  value={form.calle}
                  onChange={(e) => setForm({ ...form, calle: e.target.value })}
                  placeholder="Av. San Martín"
                  className="w-full p-3 bg-white border border-[#1C1D1F]/20 text-[#1C1D1F] text-xs focus:border-[#1C1D1F] outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase text-[#1C1D1F] mb-1">Número *</label>
                <input
                  type="text"
                  required
                  value={form.numero}
                  onChange={(e) => setForm({ ...form, numero: e.target.value })}
                  placeholder="1240"
                  className="w-full p-3 bg-white border border-[#1C1D1F]/20 text-[#1C1D1F] text-xs focus:border-[#1C1D1F] outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase text-[#1C1D1F] mb-1">Piso / Dpto</label>
                <input
                  type="text"
                  value={form.piso}
                  onChange={(e) => setForm({ ...form, piso: e.target.value })}
                  placeholder="3 B"
                  className="w-full p-3 bg-white border border-[#1C1D1F]/20 text-[#1C1D1F] text-xs focus:border-[#1C1D1F] outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase text-[#1C1D1F] mb-1">Ciudad *</label>
                <input
                  type="text"
                  required
                  value={form.ciudad}
                  onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
                  placeholder="Ciudad de Mendoza"
                  className="w-full p-3 bg-white border border-[#1C1D1F]/20 text-[#1C1D1F] text-xs focus:border-[#1C1D1F] outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase text-[#1C1D1F] mb-1">Código Postal *</label>
                <input
                  type="text"
                  required
                  value={form.codigoPostal}
                  onChange={(e) => setForm({ ...form, codigoPostal: e.target.value })}
                  placeholder="5500"
                  className="w-full p-3 bg-white border border-[#1C1D1F]/20 text-[#1C1D1F] text-xs focus:border-[#1C1D1F] outline-none"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-[10px] uppercase text-[#1C1D1F] mb-1">Provincia</label>
                <select
                  value={form.provincia}
                  onChange={(e) => setForm({ ...form, provincia: e.target.value })}
                  className="w-full p-3 bg-white border border-[#1C1D1F]/20 text-[#1C1D1F] text-xs focus:border-[#1C1D1F] outline-none"
                >
                  {PROVINCIAS_AR.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Método de Pago */}
          <div className="space-y-4 font-mono-spec text-xs">
            <span className="text-[11px] uppercase tracking-wider text-[#6B6D69] block">
              3. Forma de Pago
            </span>
            <div className="space-y-3">
              <label
                onClick={() => setMetodoPago("transferencia")}
                className={`p-4 border flex items-start gap-4 cursor-pointer transition-all ${
                  metodoPago === "transferencia"
                    ? "border-[#1C1D1F] bg-[#E5E5E1]/40"
                    : "border-[#1C1D1F]/15 bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="metodo"
                  checked={metodoPago === "transferencia"}
                  onChange={() => setMetodoPago("transferencia")}
                  className="mt-1"
                />
                <div>
                  <span className="font-bold text-[#1C1D1F] block text-xs">
                    Transferencia Bancaria &middot; 10% de Descuento Especial
                  </span>
                  <span className="text-[11px] text-[#6B6D69]">
                    Te brindamos CBU y Alias para transferir al confirmar el pedido.
                  </span>
                </div>
              </label>

              <label
                onClick={() => setMetodoPago("mercadopago")}
                className={`p-4 border flex items-start gap-4 cursor-pointer transition-all ${
                  metodoPago === "mercadopago"
                    ? "border-[#1C1D1F] bg-[#E5E5E1]/40"
                    : "border-[#1C1D1F]/15 bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="metodo"
                  checked={metodoPago === "mercadopago"}
                  onChange={() => setMetodoPago("mercadopago")}
                  className="mt-1"
                />
                <div>
                  <span className="font-bold text-[#1C1D1F] block text-xs">
                    Mercado Pago (Tarjetas de Débito, Crédito y Dinero en Cuenta)
                  </span>
                  <span className="text-[11px] text-[#6B6D69]">
                    Acreditación instantánea con procesamiento cifrado de seguridad.
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Resumen de Pedido (5 cols) */}
        <div className="lg:col-span-5 bg-[#E5E5E1]/40 border border-[#1C1D1F]/15 p-8 space-y-6 h-fit font-mono-spec">
          <div className="border-b border-[#1C1D1F]/10 pb-4">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#6B6D69] block mb-1">
              [ RESUMEN DE COMPRA ]
            </span>
            <h2 className="font-editorial text-2xl text-[#1C1D1F]">
              Piezas en tu Bolsa ({items.length})
            </h2>
          </div>

          <div className="space-y-4 max-h-72 overflow-y-auto divide-y divide-[#1C1D1F]/10 pr-2">
            {items.map((it) => (
              <div key={`${it.productoId}-${it.varianteId ?? "s"}`} className="pt-3 first:pt-0 flex justify-between items-center text-xs">
                <div>
                  <span className="font-bold text-[#1C1D1F] block">{it.nombre}</span>
                  <span className="text-[10px] text-[#6B6D69]">
                    Cant: {it.cantidad} {it.varianteEtiqueta ? `(${it.varianteEtiqueta})` : ""}
                  </span>
                </div>
                <span className="font-bold text-[#1C1D1F]">
                  {formatoARS(it.precio * it.cantidad)}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-[#1C1D1F]/10 pt-4 space-y-2 text-xs">
            <div className="flex justify-between text-[#6B6D69]">
              <span>Subtotal</span>
              <span>{formatoARS(subtotal)}</span>
            </div>
            {descTransferencia > 0 && (
              <div className="flex justify-between text-[#8A5A2B] font-bold">
                <span>Descuento Transferencia (10%)</span>
                <span>-{formatoARS(descTransferencia)}</span>
              </div>
            )}
            <div className="flex justify-between text-[#6B6D69]">
              <span>Envío</span>
              <span>A coordinar con taller</span>
            </div>
            <div className="flex justify-between text-base font-bold text-[#1C1D1F] pt-3 border-t border-[#1C1D1F]/15">
              <span>Total Final</span>
              <span>{formatoARS(total)}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={enviando}
            className="w-full py-4 bg-[#1C1D1F] hover:bg-[#8A5A2B] text-[#F7F6F2] text-xs uppercase tracking-[0.2em] transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            <Lock size={14} />
            <span>{enviando ? "Confirmando Pedido..." : `Confirmar y Pagar ${formatoARS(total)}`}</span>
          </button>

          <div className="flex items-center justify-center space-x-2 text-[10px] text-[#6B6D69] tracking-wider pt-2">
            <ShieldCheck size={14} className="text-[#8A5A2B]" />
            <span>Operación respaldada por Acacia Mates &amp; Analítica 360</span>
          </div>
        </div>
      </form>
    </div>
  );
}

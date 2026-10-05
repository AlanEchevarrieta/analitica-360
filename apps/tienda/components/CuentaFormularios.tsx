"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { borrarCuenta, guardarDatos, salir, type DatosCuenta } from "@/app/cuenta/actions";
import { BOTON, CAMPO } from "@/components/FormIngreso";
import { PROVINCIAS_AR } from "@/lib/pedidos";

type CuentaCliente = DatosCuenta & { email: string };

const CAMPOS: { k: keyof DatosCuenta; label: string; ancho?: string; tipo?: string }[] = [
  { k: "nombre", label: "Nombre completo" },
  { k: "telefono", label: "Teléfono", tipo: "tel" },
  { k: "calle", label: "Calle", ancho: "sm:col-span-2" },
  { k: "numero", label: "Número" },
  { k: "piso", label: "Piso / depto (opcional)" },
  { k: "ciudad", label: "Ciudad" },
  { k: "codigoPostal", label: "Código postal" },
];

export function DatosCuentaForm({ cuenta }: { cuenta: CuentaCliente }) {
  const [datos, setDatos] = useState<DatosCuenta>({
    nombre: cuenta.nombre,
    telefono: cuenta.telefono,
    calle: cuenta.calle,
    numero: cuenta.numero,
    piso: cuenta.piso,
    ciudad: cuenta.ciudad,
    provincia: cuenta.provincia,
    codigoPostal: cuenta.codigoPostal,
  });
  const [estado, setEstado] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  return (
    <form
      className="mt-4 grid gap-4 sm:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await guardarDatos(datos);
          setEstado(r.ok ? "Datos guardados." : r.error);
        });
      }}
    >
      {CAMPOS.map((c) => (
        <label key={c.k} className={`block text-sm font-medium ${c.ancho ?? ""}`}>
          {c.label}
          <input type={c.tipo ?? "text"} value={datos[c.k] ?? ""} onChange={(e) => setDatos({ ...datos, [c.k]: e.target.value })} className={CAMPO} />
        </label>
      ))}
      <label className="block text-sm font-medium">
        Provincia
        <select className={CAMPO} value={datos.provincia ?? ""} onChange={(e) => setDatos({ ...datos, provincia: e.target.value || null })}>
          <option value="">Elegí…</option>
          {PROVINCIAS_AR.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-4 sm:col-span-3">
        <button type="submit" disabled={pendiente} className={BOTON}>
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
        {estado ? (
          <p className="text-sm text-[var(--tinta)]/65" role="status">
            {estado}
          </p>
        ) : null}
      </div>
    </form>
  );
}

export function AccionesCuenta() {
  const router = useRouter();
  const [confirmar, setConfirmar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        disabled={pendiente}
        className="rounded-[var(--r-boton)] border border-[var(--marca-oscuro)]/20 bg-white px-4 py-2 text-sm font-medium hover:border-[var(--marca)]"
        onClick={() =>
          startTransition(async () => {
            await salir();
            router.replace("/");
            router.refresh();
          })
        }
      >
        Cerrar sesión
      </button>
      {!confirmar ? (
        <button type="button" className="text-xs text-[var(--tinta)]/50 hover:text-red-700" onClick={() => setConfirmar(true)}>
          Borrar mi cuenta
        </button>
      ) : (
        <div className="max-w-xs rounded-xl border border-red-200 bg-red-50 p-4 text-right text-sm">
          <p>Se borran tu cuenta y tus favoritos. Los pedidos que hiciste quedan registrados en la tienda.</p>
          <div className="mt-3 flex justify-end gap-4">
            <button type="button" className="text-[var(--tinta)]/60" onClick={() => setConfirmar(false)}>
              Cancelar
            </button>
            <button
              type="button"
              disabled={pendiente}
              className="font-semibold text-red-700"
              onClick={() =>
                startTransition(async () => {
                  const r = await borrarCuenta();
                  if (!r.ok) return setError(r.error);
                  router.replace("/");
                  router.refresh();
                })
              }
            >
              Sí, borrar
            </button>
          </div>
          {error ? <p className="mt-2 text-red-700">{error}</p> : null}
        </div>
      )}
    </div>
  );
}

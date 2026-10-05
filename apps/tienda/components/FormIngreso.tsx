"use client";

import Script from "next/script";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ingresarConCodigo, ingresarConGoogle, pedirCodigo } from "@/app/cuenta/actions";

type GoogleId = {
  accounts: { id: { initialize: (o: { client_id: string; callback: (r: { credential: string }) => void }) => void; renderButton: (el: HTMLElement, o: Record<string, unknown>) => void } };
};

export const CAMPO = "mt-1 w-full rounded-xl border border-[var(--marca-oscuro)]/20 bg-white px-3 py-2.5 outline-none focus:border-[var(--marca)]";
export const BOTON =
  "rounded-[var(--r-boton)] bg-[var(--marca-oscuro)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--marca-hero)] disabled:cursor-not-allowed disabled:bg-[var(--marca-oscuro)]/40";
export const ERROR = "rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700";

/** Ingreso en dos pasos: email → código de 6 números. Sin contraseñas. */
export function FormIngreso({ destino, motivo, googleClientId, nombreTienda }: { destino: string; motivo: string | null; googleClientId: string | null; nombreTienda: string }) {
  const router = useRouter();
  const [paso, setPaso] = useState<"email" | "codigo">("email");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const google = useRef<HTMLDivElement>(null);

  async function mandarCodigo() {
    setCargando(true);
    setError(null);
    const r = await pedirCodigo(email);
    setCargando(false);
    if (!r.ok) return setError(r.error);
    setPaso("codigo");
    setAviso(`Te mandamos un código a ${email.trim()}. Revisá también la carpeta de spam.`);
  }

  async function entrar(c = codigo) {
    setCargando(true);
    setError(null);
    const r = await ingresarConCodigo(email, c);
    setCargando(false);
    if (!r.ok) return setError(r.error);
    router.replace(destino);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl border border-[var(--marca-oscuro)]/10 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-medium text-[var(--marca)]">Mi cuenta en {nombreTienda}</p>
        <h1 className="mt-2 font-serif text-3xl text-[var(--tinta)]">{paso === "email" ? "Ingresar" : "Revisá tu email"}</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--tinta)]/70">
          {motivo ?? (paso === "email" ? "Seguí tus pedidos, guardá favoritos y comprá más rápido. Sin contraseñas: te mandamos un código." : aviso)}
        </p>

        {paso === "email" ? (
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void mandarCodigo();
            }}
          >
            <label className="block text-sm font-medium">
              Email
              <input type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} className={CAMPO} autoFocus />
            </label>
            {error ? <p className={ERROR}>{error}</p> : null}
            <button type="submit" disabled={cargando} className={`${BOTON} w-full`}>
              {cargando ? "Enviando…" : "Mandarme el código"}
            </button>
          </form>
        ) : (
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void entrar();
            }}
          >
            <label className="block text-sm font-medium">
              Código de 6 números
              <input
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                value={codigo}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setCodigo(v);
                  if (v.length === 6) void entrar(v);
                }}
                className={`${CAMPO} text-center font-mono text-3xl tracking-[0.5em]`}
                autoFocus
              />
            </label>
            {error ? <p className={ERROR}>{error}</p> : null}
            <button type="submit" disabled={cargando || codigo.length !== 6} className={`${BOTON} w-full`}>
              {cargando ? "Verificando…" : "Entrar"}
            </button>
            <div className="flex justify-between text-sm">
              <button
                type="button"
                className="text-[var(--tinta)]/60 hover:text-[var(--marca)]"
                onClick={() => {
                  setPaso("email");
                  setCodigo("");
                  setError(null);
                }}
              >
                ← Otro email
              </button>
              <button type="button" className="text-[var(--tinta)]/60 hover:text-[var(--marca)] disabled:opacity-40" disabled={cargando} onClick={() => void mandarCodigo()}>
                Reenviar código
              </button>
            </div>
          </form>
        )}

        {googleClientId && paso === "email" ? (
          <>
            <div className="my-6 flex items-center gap-3 text-sm text-[var(--tinta)]/40">
              <span className="h-px flex-1 bg-[var(--marca-oscuro)]/15" />o<span className="h-px flex-1 bg-[var(--marca-oscuro)]/15" />
            </div>
            <div ref={google} className="flex justify-center" />
            <Script
              src="https://accounts.google.com/gsi/client"
              strategy="afterInteractive"
              onLoad={() => {
                const g = (window as unknown as { google?: GoogleId }).google;
                if (!g || !google.current) return;
                g.accounts.id.initialize({
                  client_id: googleClientId,
                  callback: async ({ credential }) => {
                    setCargando(true);
                    const r = await ingresarConGoogle(credential);
                    setCargando(false);
                    if (!r.ok) return setError(r.error);
                    router.replace(destino);
                    router.refresh();
                  },
                });
                g.accounts.id.renderButton(google.current, { theme: "outline", size: "large", text: "continue_with", locale: "es" });
              }}
            />
          </>
        ) : null}

        <p className="mt-6 text-xs leading-5 text-[var(--tinta)]/55">
          Usamos tu email solo para tu cuenta y tus pedidos. Podés borrar tu cuenta cuando quieras desde{" "}
          <Link href="/mi-cuenta" className="underline">
            Mi cuenta
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { cancelarTurno } from "@/app/turnos/actions";
import { BOTON, ERROR } from "@/components/FormIngreso";
import type { TurnoACancelar } from "@/lib/turnos";
import { urlWhatsApp } from "@/lib/whatsapp";

/** "Cancelar mi turno": el link que le quedó al cliente al reservar. */
export function CancelarTurno({ token, turno: inicial, nombreTienda, whatsapp }: { token: string; turno: TurnoACancelar; nombreTienda: string; whatsapp: string | null }) {
  const [turno, setTurno] = useState(inicial);
  const [error, setError] = useState<string | null>(null);
  const [cancelando, cancelar] = useTransition();
  const que = `${turno.servicio ?? "Turno"} con ${turno.profesional}, ${turno.cuando}`;
  const escribir = urlWhatsApp(whatsapp, `Hola! Tengo un turno de ${que}${turno.cliente ? `, a nombre de ${turno.cliente}` : ""}.`);

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl border border-[var(--marca-oscuro)]/10 bg-white p-6 text-center shadow-sm sm:p-8">
        <p className="text-sm font-medium text-[var(--marca)]">{nombreTienda}</p>
        {turno.estado === "cancelado" ? (
          <>
            <h1 className="mt-2 font-serif text-3xl text-[var(--tinta)]">Turno cancelado</h1>
            <p className="mt-3 text-[var(--tinta)]/80">{que}. ¡Gracias por avisar!</p>
            <Link href="/turnos" className={`${BOTON} mt-6 inline-block`}>
              Reservar otro turno
            </Link>
          </>
        ) : (
          <>
            <h1 className="mt-2 font-serif text-3xl text-[var(--tinta)]">Tu turno</h1>
            <p className="mt-3 text-[var(--tinta)]/80">{que}.</p>
            {turno.cancelable ? (
              <>
                <p className="mt-3 text-sm text-[var(--tinta)]/60">Si no podés venir, cancelalo así el horario queda libre para otra persona.</p>
                {error ? <p className={`${ERROR} mt-4`}>{error}</p> : null}
                <button
                  type="button"
                  disabled={cancelando}
                  className={`${BOTON} mt-6 w-full`}
                  onClick={() =>
                    cancelar(async () => {
                      const r = await cancelarTurno(token);
                      if (r.ok) setTurno(r.turno);
                      else setError(r.error);
                    })
                  }
                >
                  {cancelando ? "Cancelando…" : "Cancelar mi turno"}
                </button>
              </>
            ) : (
              <p className="mt-3 text-sm text-[var(--tinta)]/60">Este turno ya no se puede cancelar desde acá.{escribir ? " Escribinos por WhatsApp." : ""}</p>
            )}
            {escribir ? (
              <a href={escribir} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm text-[var(--marca)] underline">
                Escribir por WhatsApp
              </a>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

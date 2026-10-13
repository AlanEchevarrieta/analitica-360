"use client";

import { useState, useTransition } from "react";
import { horariosLibres, reservarTurno } from "@/app/turnos/actions";
import { BOTON, CAMPO, ERROR } from "@/components/FormIngreso";
import { formatoARS } from "@/lib/productos";
import { proximosDias, type HorarioLibre, type OpcionesTurnos, type TurnoReservado } from "@/lib/turnos";
import { urlWhatsApp } from "@/lib/whatsapp";

type Opciones = Extract<OpcionesTurnos, { activa: true }>;

const TARJETA = "rounded-2xl border border-[var(--marca-oscuro)]/10 bg-white p-5 shadow-sm sm:p-6";
const OPCION = "rounded-xl border px-4 py-3 text-left transition";
const elegida = (si: boolean) => (si ? "border-[var(--marca)] bg-[var(--marca)]/10 ring-1 ring-[var(--marca)]" : "border-[var(--marca-oscuro)]/15 hover:border-[var(--marca)]/60");

/** Reserva de turno en cuatro pasos: servicio → con quién → día y hora → tus datos. */
export function ReservaTurno({ opciones, nombreTienda, whatsapp, cuenta }: { opciones: Opciones; nombreTienda: string; whatsapp: string | null; cuenta: { nombre: string | null; telefono: string | null } | null }) {
  const [servicioId, setServicioId] = useState<string | null>(opciones.servicios.length === 1 ? opciones.servicios[0].id : null);
  // null = "con quien esté libre"
  const [recursoId, setRecursoId] = useState<string | null>(opciones.profesionales.length === 1 ? opciones.profesionales[0].id : null);
  const dias = proximosDias(opciones.hoy, Math.min(opciones.diasMaximo + 1, 60));
  const [fecha, setFecha] = useState<string | null>(null);
  const [libres, setLibres] = useState<HorarioLibre[] | null>(null);
  const [hora, setHora] = useState<string | null>(null);
  const [nombre, setNombre] = useState(cuenta?.nombre ?? "");
  const [telefono, setTelefono] = useState(cuenta?.telefono ?? "");
  const [notas, setNotas] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<TurnoReservado | null>(null);
  const [buscando, buscar] = useTransition();
  const [reservando, reservar] = useTransition();
  const servicio = opciones.servicios.find((s) => s.id === servicioId) ?? null;
  const dia = dias.find((d) => d.fecha === fecha);
  // "hoy 12 oct", "mañana 13 oct", "el mié 14 oct"
  const diaElegido = dia ? `${dia.dia === "Hoy" || dia.dia === "Mañana" ? "" : "el "}${dia.dia.toLowerCase()} ${dia.numero}` : "";

  function traerHorarios(f: string | null, s = servicioId, r = recursoId) {
    setHora(null);
    setLibres(null);
    setError(null);
    if (!f || !s) return;
    buscar(async () => {
      const res = await horariosLibres(f, s, r);
      if (res.ok) setLibres(res.libres);
      else setError(res.error);
    });
  }

  function confirmar() {
    if (!servicioId || !fecha || !hora) return;
    if (nombre.trim().length < 2) return setError("Poné tu nombre.");
    if (telefono.replace(/\D/g, "").length < 6) return setError("Poné un teléfono para avisarte si hay algún cambio.");
    setError(null);
    reservar(async () => {
      const res = await reservarTurno({ servicioId, recursoId, fecha, hora, nombre, telefono, notas });
      if (res.ok) return setListo(res.turno);
      setError(res.error);
      // Si se lo ganó otro, se refrescan los horarios para elegir de nuevo.
      if (res.ocupado) traerHorarios(fecha);
    });
  }

  if (listo) {
    const avisar = urlWhatsApp(whatsapp, `Hola! Reservé un turno de ${listo.servicio} con ${listo.profesional} ${listo.cuando}. A nombre de ${nombre.trim()}.`);
    const linkCancelar = `/turnos/cancelar/${listo.cancelar}`;
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <div className={`${TARJETA} text-center`}>
          <p className="text-4xl" aria-hidden>
            ✓
          </p>
          <h1 className="mt-2 font-serif text-3xl text-[var(--tinta)]">¡Turno reservado!</h1>
          <p className="mt-3 text-[var(--tinta)]/80">
            {listo.servicio} con <strong>{listo.profesional}</strong>, {listo.cuando}.
          </p>
          {listo.mensaje ? <p className="mt-3 rounded-xl bg-[var(--marca)]/10 px-3 py-2 text-sm">{listo.mensaje}</p> : null}
          <p className="mt-3 text-sm text-[var(--tinta)]/60">
            Si no podés venir, cancelalo desde{" "}
            <a href={linkCancelar} className="text-[var(--marca)] underline">
              este link
            </a>{" "}
            (guardalo) o avisá a {nombreTienda}, así el horario queda para otra persona.
          </p>
          {avisar ? (
            <a href={avisar} target="_blank" rel="noreferrer" className={`${BOTON} mt-6 inline-block`}>
              Avisar por WhatsApp
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  const paso = (n: number, titulo: string, hecho: boolean) => (
    <h2 className="flex items-center gap-2 font-serif text-xl text-[var(--tinta)]">
      <span className={`flex size-7 items-center justify-center rounded-full text-sm font-semibold ${hecho ? "bg-[var(--marca)] text-white" : "bg-[var(--marca-oscuro)]/10 text-[var(--marca-oscuro)]"}`}>{n}</span>
      {titulo}
    </h2>
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-10">
      <div>
        <p className="text-sm font-medium text-[var(--marca)]">{nombreTienda}</p>
        <h1 className="mt-1 font-serif text-3xl text-[var(--tinta)] sm:text-4xl">Reservar turno</h1>
      </div>

      <section className={TARJETA}>
        {paso(1, "¿Qué servicio?", Boolean(servicio))}
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {opciones.servicios.map((s) => (
            <button key={s.id} type="button" onClick={() => (setServicioId(s.id), traerHorarios(fecha, s.id))} className={`${OPCION} ${elegida(s.id === servicioId)}`}>
              <span className="block font-medium">{s.nombre}</span>
              <span className="text-sm text-[var(--tinta)]/60">
                {s.duracionMin} min{s.precio ? ` · ${formatoARS(s.precio)}` : ""}
              </span>
            </button>
          ))}
        </div>
      </section>

      {opciones.profesionales.length > 1 ? (
        <section className={TARJETA}>
          {paso(2, "¿Con quién?", true)}
          <div className="mt-4 flex flex-wrap gap-2">
            {[{ id: null as string | null, nombre: "Con quien esté libre", color: null as string | null }, ...opciones.profesionales].map((p) => (
              <button key={p.id ?? "cualquiera"} type="button" onClick={() => (setRecursoId(p.id), traerHorarios(fecha, servicioId, p.id))} className={`${OPCION} flex items-center gap-2 py-2 ${elegida(p.id === recursoId)}`}>
                {p.color ? <span className="size-2.5 rounded-full" style={{ background: p.color }} aria-hidden /> : null}
                {p.nombre}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className={`${TARJETA} ${servicio ? "" : "opacity-50"}`}>
        {paso(opciones.profesionales.length > 1 ? 3 : 2, "¿Qué día y a qué hora?", Boolean(hora))}
        {!servicio ? <p className="mt-3 text-sm text-[var(--tinta)]/60">Primero elegí el servicio.</p> : null}
        <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-2">
          {dias.map((d) => (
            <button
              key={d.fecha}
              type="button"
              disabled={!servicio}
              onClick={() => (setFecha(d.fecha), traerHorarios(d.fecha))}
              className={`${OPCION} flex min-w-16 shrink-0 flex-col items-center px-3 py-2 ${elegida(d.fecha === fecha)}`}
            >
              <span className="text-xs text-[var(--tinta)]/60">{d.dia}</span>
              <span className="whitespace-nowrap text-sm font-medium">{d.numero}</span>
            </button>
          ))}
        </div>
        {buscando ? <p className="mt-3 text-sm text-[var(--tinta)]/60">Buscando horarios…</p> : null}
        {libres && libres.length === 0 ? <p className="mt-3 text-sm text-[var(--tinta)]/70">Ese día no quedan horarios libres. Probá con otro.</p> : null}
        {libres && libres.length > 0 ? (
          <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
            {libres.map((l) => (
              <button key={l.hora} type="button" onClick={() => setHora(l.hora)} className={`${OPCION} px-2 py-2 text-center text-sm font-medium tabular-nums ${elegida(l.hora === hora)}`}>
                {l.hora}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {hora ? (
        <section className={TARJETA}>
          {paso(opciones.profesionales.length > 1 ? 4 : 3, "Tus datos", false)}
          <form
            className="mt-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              confirmar();
            }}
          >
            <label className="block text-sm font-medium">
              Nombre y apellido
              <input required autoComplete="name" value={nombre} onChange={(e) => setNombre(e.target.value)} className={CAMPO} maxLength={120} />
            </label>
            <label className="block text-sm font-medium">
              Teléfono (WhatsApp)
              <input required type="tel" autoComplete="tel" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} className={CAMPO} maxLength={40} placeholder="Ej. 261 555 1234" />
            </label>
            <label className="block text-sm font-medium">
              ¿Algo que tengamos que saber? (opcional)
              <textarea rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} className={CAMPO} maxLength={500} />
            </label>
            {error ? <p className={ERROR}>{error}</p> : null}
            <button type="submit" disabled={reservando} className={`${BOTON} w-full`}>
              {reservando ? "Reservando…" : `Reservar ${servicio?.nombre ?? ""} ${diaElegido} a las ${hora}`}
            </button>
          </form>
        </section>
      ) : error ? (
        <p className={ERROR}>{error}</p>
      ) : null}
    </div>
  );
}

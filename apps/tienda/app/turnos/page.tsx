import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReservaTurno } from "@/components/ReservaTurno";
import { BOTON } from "@/components/FormIngreso";
import { cuentaActual } from "@/lib/sesion";
import { obtenerSitio } from "@/lib/sitio";
import { opcionesTurnos } from "@/lib/turnos";
import { urlWhatsApp } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reservar turno" };

export default async function TurnosPage() {
  const sitio = await obtenerSitio();
  if (!sitio) notFound();
  const [opciones, cuenta] = await Promise.all([opcionesTurnos(sitio.empresaId), cuentaActual()]);
  if (!opciones.activa || opciones.servicios.length === 0 || opciones.profesionales.length === 0) {
    // En vez de "no encontramos": que el cliente sepa que puede pedir el turno por WhatsApp.
    const escribir = urlWhatsApp(sitio.whatsapp, "Hola! Quería pedir un turno.");
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-serif text-3xl text-[var(--tinta)]">Reservar turno</h1>
        <p className="mt-3 text-[var(--tinta)]/70">{sitio.nombre} todavía no toma turnos online.{escribir ? " Pedilo por WhatsApp y te lo damos." : ""}</p>
        <div className="mt-6 flex flex-col items-center gap-3">
          {escribir ? (
            <a href={escribir} target="_blank" rel="noreferrer" className={BOTON}>
              Pedir turno por WhatsApp
            </a>
          ) : null}
          <Link href="/" className="text-sm text-[var(--marca)] underline">
            Volver a la tienda
          </Link>
        </div>
      </div>
    );
  }
  return <ReservaTurno opciones={opciones} nombreTienda={sitio.nombre} whatsapp={sitio.whatsapp} cuenta={cuenta ? { nombre: cuenta.nombre, telefono: cuenta.telefono } : null} />;
}

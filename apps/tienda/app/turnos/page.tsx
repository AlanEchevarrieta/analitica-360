import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReservaTurno } from "@/components/ReservaTurno";
import { cuentaActual } from "@/lib/sesion";
import { obtenerSitio } from "@/lib/sitio";
import { opcionesTurnos } from "@/lib/turnos";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reservar turno" };

export default async function TurnosPage() {
  const sitio = await obtenerSitio();
  if (!sitio) notFound();
  const [opciones, cuenta] = await Promise.all([opcionesTurnos(sitio.empresaId), cuentaActual()]);
  if (!opciones.activa || opciones.servicios.length === 0 || opciones.profesionales.length === 0) notFound();
  return <ReservaTurno opciones={opciones} nombreTienda={sitio.nombre} whatsapp={sitio.whatsapp} cuenta={cuenta ? { nombre: cuenta.nombre, telefono: cuenta.telefono } : null} />;
}

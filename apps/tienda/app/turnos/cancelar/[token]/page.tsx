import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CancelarTurno } from "@/components/CancelarTurno";
import { obtenerSitio } from "@/lib/sitio";
import { turnoACancelar } from "@/lib/turnos";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cancelar turno", robots: { index: false } };

export default async function CancelarTurnoPage(props: PageProps<"/turnos/cancelar/[token]">) {
  const sitio = await obtenerSitio();
  if (!sitio) notFound();
  const { token } = await props.params;
  const turno = await turnoACancelar(sitio.empresaId, token);
  if (!turno) notFound();
  return <CancelarTurno token={token} turno={turno} nombreTienda={sitio.nombre} whatsapp={sitio.whatsapp} />;
}

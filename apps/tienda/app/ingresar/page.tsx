import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FormIngreso } from "@/components/FormIngreso";
import { cuentaActual } from "@/lib/sesion";
import { obtenerSitio } from "@/lib/sitio";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ingresar", robots: { index: false } };

type Props = { searchParams: Promise<{ volver?: string; motivo?: string }> };

/** Solo rutas internas (que no se pueda usar para mandar a alguien a otro sitio). */
const destinoSeguro = (v?: string) => (v && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : "/mi-cuenta");

export default async function IngresarPage({ searchParams }: Props) {
  const sitio = await obtenerSitio();
  if (!sitio) notFound();
  const { volver, motivo } = await searchParams;
  const destino = destinoSeguro(volver);
  if (await cuentaActual()) redirect(destino);
  return (
    <FormIngreso
      destino={destino}
      motivo={motivo === "favoritos" ? "Ingresá para guardar tus favoritos." : null}
      googleClientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || null}
      nombreTienda={sitio.nombre}
    />
  );
}

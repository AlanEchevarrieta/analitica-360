import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { Sitio } from "@/features/sitio/components/Sitio";

const DESCRIPCION = "Sistema de gestión para comercios: ventas, stock, compras, clientes, analytics, contabilidad y tienda online. Probalo 14 días gratis, sin tarjeta.";

export const metadata: Metadata = {
  title: "Analítica 360 · Sistema de gestión para comercios",
  description: DESCRIPCION,
  alternates: { canonical: "/" },
  openGraph: { type: "website", locale: "es_AR", siteName: "Analítica 360", title: "Analítica 360 · Todo tu comercio en un solo lugar", description: DESCRIPCION },
  twitter: { card: "summary_large_image", title: "Analítica 360 · Todo tu comercio en un solo lugar", description: DESCRIPCION },
};

// Visitantes: la landing. Con sesión: al login, a elegir empresa o al inicio, como siempre.
export default async function Home() {
  const { userId, orgId } = await auth({ treatPendingAsSignedOut: false });
  if (!userId) return <Sitio />;
  redirect(orgId ? "/inicio" : "/elegir-empresa");
}

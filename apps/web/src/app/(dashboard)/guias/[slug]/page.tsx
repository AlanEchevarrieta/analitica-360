import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  TODAS_LAS_GUIAS,
  obtenerGuiaPorSlug,
  obtenerAnteriorGuia,
  obtenerSiguienteGuia,
} from "@/lib/guias/guias-db";
import { renderizarGuiaMarkdown } from "@/lib/guias/markdown";
import { GuiaDetalleVista } from "@/features/guias/components/GuiaDetalleVista";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return TODAS_LAS_GUIAS.map((guia) => ({
    slug: guia.slug,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const guia = obtenerGuiaPorSlug(slug);

  if (!guia) {
    return {
      title: "Guía no encontrada | Analítica 360",
    };
  }

  return {
    title: `${guia.titulo} | Manuales Analítica 360`,
    description: guia.resumen,
  };
}

export default async function GuiaSlugPage({ params }: PageProps) {
  const { slug } = await params;
  const guia = obtenerGuiaPorSlug(slug);

  if (!guia) {
    notFound();
  }

  const htmlContenido = renderizarGuiaMarkdown(guia.contenido);
  const anterior = obtenerAnteriorGuia(slug);
  const siguiente = obtenerSiguienteGuia(slug);

  return (
    <GuiaDetalleVista
      guia={guia}
      htmlContenido={htmlContenido}
      anterior={anterior}
      siguiente={siguiente}
    />
  );
}

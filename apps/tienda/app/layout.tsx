import type { Metadata } from "next";
import { Cormorant_Garamond, Inter, Montserrat, Nunito, Playfair_Display } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { TiendaNoEncontrada } from "@/components/TiendaNoEncontrada";
import { obtenerSitio } from "@/lib/sitio";
import { categoriasDe, listarProductos } from "@/lib/productos";
import { idsFavoritos, tokenSesion } from "@/lib/sesion";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair" });
// Tipografías opcionales de títulos: el navegador solo descarga la que la tienda usa.
const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-cormorant", preload: false });
const montserrat = Montserrat({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-montserrat", preload: false });
const nunito = Nunito({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-nunito", preload: false });

export async function generateMetadata(): Promise<Metadata> {
  const sitio = await obtenerSitio();
  if (!sitio) return { title: "Tienda no encontrada" };
  return {
    title: { default: sitio.descripcion ? `${sitio.nombre} — ${sitio.descripcion}` : sitio.nombre, template: `%s — ${sitio.nombre}` },
    description: sitio.descripcion ?? `Tienda online de ${sitio.nombre}`,
    icons: sitio.logoUrl ? { icon: sitio.logoUrl } : undefined,
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const sitio = await obtenerSitio();
  // Menú de categorías (catálogo cacheado 2 minutos) y sesión del comprador.
  const [categorias, conSesion, favoritos] = sitio
    ? await Promise.all([listarProductos(sitio, 120).then(categoriasDe), tokenSesion().then(Boolean), idsFavoritos()])
    : [[], false, []];
  return (
    <html
      lang="es-AR"
      className={`${inter.variable} ${playfair.variable} ${cormorant.variable} ${montserrat.variable} ${nunito.variable} h-full antialiased`}
      data-fondo={sitio?.fondo}
      data-tipo={sitio?.tipografia}
      data-bordes={sitio?.bordes}
      data-foto={sitio?.formaFoto}
      data-columnas={sitio?.columnasCelular}
      // El color de marca del negocio: de él salen todos los colores de la tienda (globals.css).
      style={sitio ? ({ "--marca": sitio.color } as React.CSSProperties) : undefined}
    >
      <body className="flex min-h-full flex-col font-sans">{sitio ? (
          <AppShell sitio={sitio} categorias={categorias} conSesion={conSesion} favoritos={favoritos}>
            {children}
          </AppShell>
        ) : (
          <TiendaNoEncontrada />
        )}</body>
    </html>
  );
}

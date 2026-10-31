import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { cookies, headers } from "next/headers";
import { ClerkProvider } from "@clerk/nextjs";
import { esES } from "@clerk/localizations";
import { Providers } from "@/components/providers";
import { COOKIE_PALETA, esPaleta } from "@/lib/paletas";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const viewport: Viewport = {
  themeColor: "#00E5C9",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITIO_URL ?? "https://analitica360.app"),
  title: "Analítica 360",
  description: "Gestión comercial: stock, ventas, compras, clientes y analytics.",
  applicationName: "Analítica 360",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Analítica 360",
  },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Paleta elegida por el usuario (cookie): el HTML ya sale con sus colores.
  const paleta = (await cookies()).get(COOKIE_PALETA)?.value;
  // Nonce de la CSP (lo genera el proxy): el script del tema lo necesita para poder correr.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <ClerkProvider
      dynamic
      localization={esES}
      // Cuenta nueva sin empresa: Clerk pide elegir/crear organización; ese paso es nuestra bienvenida (registro con prueba gratis).
      taskUrls={{ "choose-organization": "/bienvenida" }}
    >
      <html lang="es" className={`${inter.variable} h-full antialiased`} data-paleta={esPaleta(paleta) ? paleta : undefined} suppressHydrationWarning>
        <body className="min-h-full flex flex-col">
          <Providers nonce={nonce}>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}

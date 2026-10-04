import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Analítica 360",
  description: "Gestión comercial: stock, ventas, compras, clientes y analytics.",
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

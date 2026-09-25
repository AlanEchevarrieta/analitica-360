import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import { ClerkProvider } from "@clerk/nextjs";
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
  return (
    <ClerkProvider>
      <html lang="es" className={`${inter.variable} h-full antialiased`} data-paleta={esPaleta(paleta) ? paleta : undefined} suppressHydrationWarning>
        <body className="min-h-full flex flex-col">
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}

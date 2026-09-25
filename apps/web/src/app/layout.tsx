import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Providers } from "@/components/providers";
import { SCRIPT_PALETA } from "@/lib/paletas";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ClerkProvider>
      <html lang="es" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
        <head>
          {/* Aplica la paleta guardada antes de pintar (sin parpadeo del color por defecto). */}
          <script dangerouslySetInnerHTML={{ __html: SCRIPT_PALETA }} />
        </head>
        <body className="min-h-full flex flex-col">
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}

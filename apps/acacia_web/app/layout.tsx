import type { Metadata } from "next";
import { Cormorant_Garamond, Inter, Space_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CarritoDrawer } from "@/components/carrito/CarritoDrawer";
import { CarritoProvider } from "@/lib/carrito";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const spaceMono = Space_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Acacia Mates · Objetos Nobles y Pausa",
  description:
    "Mates artesanales de calabaza y madera noble, bombillas de alpaca cincelada y marroquinería en cuero genuino. Inspiración Snow Peak y forja criolla.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${cormorant.variable} ${inter.variable} ${spaceMono.variable}`}>
      <body className="font-sans min-h-screen flex flex-col bg-[#F7F6F2] text-[#1C1D1F]">
        <CarritoProvider>
          <Header />
          <main className="flex-1 grain-overlay">{children}</main>
          <CarritoDrawer />
          <Footer />
        </CarritoProvider>
      </body>
    </html>
  );
}

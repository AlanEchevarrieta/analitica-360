import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { DIAS_PRUEBA } from "@/features/sitio/contenido";

// Imagen que se ve al compartir el link (WhatsApp, Facebook, LinkedIn, X). Se genera una vez al compilar.
export const alt = "Analítica 360: todo tu comercio en un solo lugar. Ventas, stock, compras, clientes y tienda online.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INDIGO = "#4f46e5";
const VIOLETA = "#7c3aed";
const TINTA = "#0f172a";
const GRIS = "#475569";

/** Barras de la maqueta (ventas de la semana, números de ejemplo). */
const BARRAS = [38, 52, 44, 63, 58, 80, 72];

// Inter (licencia OFL, la misma letra de la app), guardada en el proyecto: la imagen sale igual sin internet.
const fuente = (archivo: string) => readFile(join(process.cwd(), "src/app/_fuentes", archivo));
const FUENTES = Promise.all([fuente("Inter-Regular.ttf"), fuente("Inter-SemiBold.ttf"), fuente("Inter-ExtraBold.ttf")]);
const NEGRITA = { fontWeight: 800 } as const;
const SEMI = { fontWeight: 600 } as const;

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "linear-gradient(135deg, #ffffff 0%, #f5f3ff 55%, #ede9fe 100%)",
          padding: "64px 72px",
          fontFamily: "Inter",
          fontWeight: 400,
          color: TINTA,
        }}
      >
        {/* Texto */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 640 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <svg width="56" height="56" viewBox="0 0 120 120" fill="none">
              <defs>
                <linearGradient id="og-ring" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#00e5c9" />
                  <stop offset="60%" stopColor="#00d2b4" />
                  <stop offset="85%" stopColor="#0ea5e9" />
                  <stop offset="100%" stopColor="#2563eb" />
                </linearGradient>
                <linearGradient id="og-apex" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00e5c9" />
                  <stop offset="100%" stopColor="#00d2b4" />
                </linearGradient>
                <linearGradient id="og-left" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#00e5c9" />
                  <stop offset="100%" stopColor="#00b4d8" />
                </linearGradient>
                <linearGradient id="og-right" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00d2b4" />
                  <stop offset="60%" stopColor="#0ea5e9" />
                  <stop offset="100%" stopColor="#2563eb" />
                </linearGradient>
              </defs>
              <path d="M 20,54 A 42 14.5 0 0 1 100,54" stroke="url(#og-ring)" strokeWidth="12" strokeLinecap="round" />
              <path d="M 43,51 L 60,18 C 60.5,17 61.5,17 62,18 L 79,51" stroke="url(#og-apex)" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M 42,56 L 31,84" stroke="url(#og-left)" strokeWidth="12" strokeLinecap="round" />
              <path d="M 78,56 L 89,84" stroke="url(#og-right)" strokeWidth="12" strokeLinecap="round" />
              <path d="M 20,54 A 42 14.5 0 0 0 100,54" stroke="url(#og-ring)" strokeWidth="12" strokeLinecap="round" />
            </svg>
            <span style={{ ...NEGRITA, fontSize: 34, letterSpacing: -0.5 }}>Analítica 360</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ ...NEGRITA, fontSize: 70, lineHeight: 1.05, letterSpacing: -2.5 }}>Todo tu comercio,</span>
            <span style={{ ...NEGRITA, fontSize: 70, lineHeight: 1.05, letterSpacing: -2.5, color: INDIGO }}>en un solo lugar</span>
            <span style={{ marginTop: 24, fontSize: 28, lineHeight: 1.35, color: GRIS }}>Ventas, stock, compras, clientes, números claros y tu tienda online, conectados.</span>
          </div>

          <div style={{ display: "flex", gap: 14 }}>
            <span style={{ display: "flex", background: INDIGO, color: "#fff", ...SEMI, fontSize: 24, padding: "12px 22px", borderRadius: 14, whiteSpace: "nowrap" }}>Probá {DIAS_PRUEBA} días gratis</span>
            <span style={{ display: "flex", background: "#fff", color: VIOLETA, fontSize: 24, fontWeight: 600, padding: "12px 22px", borderRadius: 14, border: "2px solid #ddd6fe", whiteSpace: "nowrap" }}>Beneficio para socios UCIM</span>
          </div>
        </div>

        {/* Maqueta: una tarjeta como las del sistema */}
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "flex-end" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: 360,
              background: "#fff",
              borderRadius: 28,
              padding: 32,
              boxShadow: "0 30px 60px -20px rgba(79, 70, 229, 0.35)",
              border: "1px solid #e9e5ff",
            }}
          >
            <span style={{ fontSize: 20, color: GRIS }}>Ventas de la semana</span>
            <span style={{ ...NEGRITA, fontSize: 44, marginTop: 6, letterSpacing: -1 }}>$ 1.284.500</span>
            <span style={{ display: "flex", marginTop: 8, fontSize: 19, color: "#059669", fontWeight: 600, whiteSpace: "nowrap" }}>▲ 18 % más que la semana pasada</span>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 150, marginTop: 28 }}>
              {BARRAS.map((h, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    width: 34,
                    height: `${h + 20}%`,
                    borderRadius: 8,
                    background: i === BARRAS.length - 2 ? `linear-gradient(180deg, ${VIOLETA}, ${INDIGO})` : "#c7d2fe",
                  }}
                />
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 16, color: "#94a3b8" }}>
              {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                <span key={i} style={{ width: 34, display: "flex", justifyContent: "center" }}>
                  {d}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: await FUENTES.then(([regular, semi, negrita]) => [
        { name: "Inter", data: regular, weight: 400 as const, style: "normal" as const },
        { name: "Inter", data: semi, weight: 600 as const, style: "normal" as const },
        { name: "Inter", data: negrita, weight: 800 as const, style: "normal" as const },
      ]),
    },
  );
}

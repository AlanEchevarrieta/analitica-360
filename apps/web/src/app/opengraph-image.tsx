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
            <svg width="56" height="56" viewBox="0 0 32 32">
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#6366f1" />
                  <stop offset="1" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
              <rect width="32" height="32" rx="9" fill="url(#g)" />
              <circle cx="16" cy="16" r="9" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="2.5" />
              <path d="M16 7a9 9 0 0 1 8.6 6.3" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
              <rect x="11" y="16" width="2.6" height="5" rx="1" fill="#fff" />
              <rect x="14.7" y="13.5" width="2.6" height="7.5" rx="1" fill="#fff" />
              <rect x="18.4" y="11" width="2.6" height="10" rx="1" fill="#fff" />
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

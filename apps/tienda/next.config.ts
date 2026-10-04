import path from "node:path";
import type { NextConfig } from "next";

const standalone = process.env.NEXT_OUTPUT === "standalone";

// CSP de la tienda: páginas en caché (sin nonce), así que los scripts propios van con
// 'unsafe-inline' pero solo desde este mismo sitio; las fotos pueden venir del almacenamiento.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https: http:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Cabeceras de seguridad (ZAP: la tienda no mandaba ninguna).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
    ];
  },
  // Permite compilar para medir sin pisar la carpeta del servidor de desarrollo.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Imagen de Docker (ver apps/tienda/Dockerfile): servidor mínimo, con la raíz del monorepo.
  ...(standalone ? { output: "standalone", outputFileTracingRoot: path.resolve(process.cwd(), "../..") } : {}),
};

export default nextConfig;

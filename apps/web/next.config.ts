import path from "node:path";
import type { NextConfig } from "next";

const standalone = process.env.NEXT_OUTPUT === "standalone";

const nextConfig: NextConfig = {
  transpilePackages: ["@analitica360/shared-types"],
  // Permite compilar la versión de producción en otra carpeta sin pisar la del
  // servidor de desarrollo (NEXT_DIST_DIR=.next-build pnpm build).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Imagen de Docker: servidor mínimo con solo lo necesario (ver apps/web/Dockerfile).
  // La raíz del monorepo para que incluya packages/shared-types y el node_modules de pnpm.
  poweredByHeader: false,
  // Cabeceras de seguridad: nada de mostrar la app dentro de un iframe ajeno
  // (clickjacking), sin adivinar tipos de archivo y sin mandar la URL completa a otros sitios.
  // La cámara queda permitida para el lector de códigos de barra.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          // Aísla la ventana de otras pestañas (las ventanas de inicio de sesión de Clerk siguen andando).
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
    ];
  },
  ...(standalone ? { output: "standalone", outputFileTracingRoot: path.resolve(process.cwd(), "../..") } : {}),
};

export default nextConfig;

import path from "node:path";
import type { NextConfig } from "next";

const standalone = process.env.NEXT_OUTPUT === "standalone";

const nextConfig: NextConfig = {
  // Permite compilar para medir sin pisar la carpeta del servidor de desarrollo.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Imagen de Docker (ver apps/tienda/Dockerfile): servidor mínimo, con la raíz del monorepo.
  ...(standalone ? { output: "standalone", outputFileTracingRoot: path.resolve(process.cwd(), "../..") } : {}),
};

export default nextConfig;

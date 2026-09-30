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
  ...(standalone ? { output: "standalone", outputFileTracingRoot: path.resolve(process.cwd(), "../..") } : {}),
};

export default nextConfig;

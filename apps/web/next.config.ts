import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@analitica360/shared-types"],
  // Permite compilar la versión de producción en otra carpeta sin pisar la del
  // servidor de desarrollo (NEXT_DIST_DIR=.next-build pnpm build).
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;

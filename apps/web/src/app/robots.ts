import type { MetadataRoute } from "next";

const SITIO = process.env.NEXT_PUBLIC_SITIO_URL ?? "https://analitica360.app";

/** Solo lo público se indexa; el sistema queda afuera. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: ["/", "/terminos", "/privacidad"], disallow: ["/inicio", "/admin", "/api"] }, sitemap: `${SITIO}/sitemap.xml` };
}

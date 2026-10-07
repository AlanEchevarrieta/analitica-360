import type { MetadataRoute } from "next";

const SITIO = process.env.NEXT_PUBLIC_SITIO_URL ?? "https://analitica360.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITIO, changeFrequency: "weekly", priority: 1 },
    { url: `${SITIO}/terminos`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITIO}/privacidad`, changeFrequency: "yearly", priority: 0.3 },
  ];
}

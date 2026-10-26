import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Next.js 16 renombró el convenio "middleware" a "proxy".
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/terminos",
  "/privacidad",
  "/robots.txt",
  "/sitemap.xml",
  // Imagen para compartir el link (la piden WhatsApp y las redes, sin sesión).
  "/opengraph-image(.*)",
  // Estas dos validan la sesión en la propia página: con la sesión "pendiente"
  // (cuenta nueva sin empresa) auth.protect() la trataría como deslogueada.
  "/bienvenida",
  "/elegir-empresa",
  "/api/webhooks/clerk",
]);

function obtenerOrigenesValidos(url?: string): string[] {
  if (!url) return [];
  try {
    const parsed = new URL(url);
    // CSP requiere el origen (protocolo + host + puerto), sin ruta (/api)
    return [parsed.origin];
  } catch {
    const limpio = url.replace(/\/+$/, "");
    return limpio ? [limpio] : [];
  }
}

const apiOrigins = [
  ...obtenerOrigenesValidos(process.env.NEXT_PUBLIC_API_URL),
  ...obtenerOrigenesValidos(process.env.API_URL_INTERNA),
];

const dominiosConexion = Array.from(
  new Set([
    "self",
    "https://analitica360.app",
    "https://*.analitica360.app",
    "http://localhost:*",
    "http://127.0.0.1:*",
    ...apiOrigins,
  ]),
);

const dominiosImagenes = Array.from(
  new Set([
    "self",
    "data:",
    "blob:",
    "https://analitica360.app",
    "https://*.analitica360.app",
    "https://img.clerk.com",
    "http://localhost:*",
    "http://127.0.0.1:*",
    ...apiOrigins,
  ]),
);

export default clerkMiddleware(
  async (auth, request) => {
    if (isPublicRoute(request)) return;
    // Cuenta nueva que todavía no creó su empresa: a la bienvenida, no al login.
    const { sessionStatus } = await auth({ treatPendingAsSignedOut: false });
    if (sessionStatus === "pending") return NextResponse.redirect(new URL("/bienvenida", request.url));
    await auth.protect();
  },
  {
    // CSP estricta (OWASP ASVS V14.4, hallazgo de ZAP): solo corren los scripts con el
    // nonce de cada pedido (Next y Clerk lo usan solos) y los que ellos cargan.
    // Las páginas son dinámicas (el layout lee cookies), así que el nonce llega a todas.
    contentSecurityPolicy: {
      strict: true,
      directives: {
        "connect-src": dominiosConexion,
        // Fotos: de la API (/archivos) y avatares de Clerk (que ya trae su default).
        "img-src": dominiosImagenes,
        "font-src": ["self", "data:"],
        "object-src": ["none"],
        "base-uri": ["self"],
        "frame-ancestors": ["none"],
      },
    },
  },
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

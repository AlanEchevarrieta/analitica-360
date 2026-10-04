import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Next.js 16 renombró el convenio "middleware" a "proxy".
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/terminos",
  "/privacidad",
  // Estas dos validan la sesión en la propia página: con la sesión "pendiente"
  // (cuenta nueva sin empresa) auth.protect() la trataría como deslogueada.
  "/bienvenida",
  "/elegir-empresa",
  "/api/webhooks/clerk",
]);

// La API (datos y fotos de /archivos) vive en otro origen: hay que permitirla.
const API = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");

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
        "connect-src": API ? [API] : [],
        // Fotos: de la API (/archivos) y avatares de Clerk (que ya trae su default). Con el
        // almacenamiento de producción, sumar su dominio acá.
        "img-src": ["self", "data:", "blob:", ...(API ? [API] : [])],
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

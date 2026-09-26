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

export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) return;
  // Cuenta nueva que todavía no creó su empresa: a la bienvenida, no al login.
  const { sessionStatus } = await auth({ treatPendingAsSignedOut: false });
  if (sessionStatus === "pending") return NextResponse.redirect(new URL("/bienvenida", request.url));
  await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

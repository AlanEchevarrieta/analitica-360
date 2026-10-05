import { Suspense } from "react";
import { SignUp } from "@clerk/nextjs";
import { GuardarCodigoDelLink } from "@/features/registro/codigo-guardado";

export default function Page() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-12">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Probá Analítica 360 gratis</h1>
        <p className="text-sm text-muted-foreground">14 días con todas las funciones · sin tarjeta</p>
      </div>
      {/* Link de recomendación (?codigo=): queda guardado para la bienvenida. */}
      <Suspense>
        <GuardarCodigoDelLink />
      </Suspense>
      {/* Después de crear la cuenta: datos del negocio (bienvenida) y adentro. */}
      <SignUp forceRedirectUrl="/bienvenida" signInUrl="/sign-in" />
    </div>
  );
}

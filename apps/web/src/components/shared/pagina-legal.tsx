import type { ReactNode } from "react";
import Link from "next/link";

/** Marco de las páginas legales públicas (términos, privacidad). */
export function PaginaLegal({ titulo, version, children }: { titulo: string; version: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-10 text-sm leading-relaxed">
      <Link href="/" className="font-semibold text-primary">
        Analítica 360
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">{titulo}</h1>
        <p className="text-muted-foreground">{version}</p>
      </div>
      {children}
      <p className="border-t pt-4 text-muted-foreground">
        <Link href="/terminos" className="underline">
          Términos y condiciones
        </Link>{" "}
        ·{" "}
        <Link href="/privacidad" className="underline">
          Política de privacidad
        </Link>
      </p>
    </main>
  );
}

export function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h2 className="font-semibold">{titulo}</h2>
      <p>{children}</p>
    </section>
  );
}

/** Dirección sin tienda (o tienda no publicada). */
export function TiendaNoEncontrada() {
  return (
    <main className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="text-5xl" aria-hidden>
        🛍️
      </p>
      <h1 className="mt-4 font-serif text-3xl">Esta tienda no está disponible</h1>
      <p className="mt-3 text-sm text-[var(--tinta)]/70">Puede que la dirección esté mal escrita o que el negocio todavía no haya publicado su tienda.</p>
    </main>
  );
}

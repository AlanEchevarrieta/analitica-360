import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="font-serif text-3xl">No encontramos esa página</h1>
      <p className="mt-3 text-sm text-[var(--tinta)]/70">Probá volver al catálogo.</p>
      <Link href="/productos" className="mt-6 inline-block text-[var(--marca)] underline">
        Ver productos
      </Link>
    </div>
  );
}

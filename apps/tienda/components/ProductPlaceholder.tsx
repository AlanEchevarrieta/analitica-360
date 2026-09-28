/** Producto sin foto: el nombre sobre un fondo con el color de la marca. */
export function ProductPlaceholder({ nombre, large = false }: { nombre: string; large?: boolean }) {
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${large ? "aspect-square w-full rounded-3xl" : "aspect-[4/3]"}`}
      style={{ background: "linear-gradient(145deg, var(--crema) 0%, color-mix(in srgb, var(--marca) 22%, transparent) 60%, var(--marca-hero) 150%)" }}
      aria-hidden
    >
      <span className="relative px-4 text-center font-serif text-lg text-[var(--marca-oscuro)] sm:text-xl">{nombre}</span>
    </div>
  );
}

/** Foto principal del producto (o el placeholder si no tiene). */
export function FotoProducto({ nombre, url, large = false }: { nombre: string; url: string | undefined; large?: boolean }) {
  if (!url) return <ProductPlaceholder nombre={nombre} large={large} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- fotos servidas por la plataforma (otro origen)
    <img src={url} alt={nombre} loading="lazy" className={`w-full bg-white object-cover ${large ? "aspect-square rounded-3xl" : "aspect-[4/3]"}`} />
  );
}

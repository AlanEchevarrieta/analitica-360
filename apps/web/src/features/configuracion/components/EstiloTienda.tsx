"use client";

import { Cormorant_Garamond, Montserrat, Nunito, Playfair_Display } from "next/font/google";
import { cn } from "@/lib/utils";

/* Mismas opciones que entiende la tienda (apps/tienda/app/globals.css). */
export type Fondo = "puntos" | "lienzo" | "papel" | "rayas" | "ondas" | "liso";
export type Tipografia = "clasica" | "elegante" | "moderna" | "amigable";
export type Bordes = "redondeados" | "suaves" | "rectos";
export type FormaFoto = "horizontal" | "cuadrada" | "vertical";

// Las mismas tipografías de la tienda, para que la vista previa sea fiel (solo se descargan en esta pantalla).
const playfair = Playfair_Display({ subsets: ["latin"], preload: false });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["600"], preload: false });
const montserrat = Montserrat({ subsets: ["latin"], weight: ["700"], preload: false });
const nunito = Nunito({ subsets: ["latin"], weight: ["800"], preload: false });

export const TIPOGRAFIAS: { v: Tipografia; t: string; detalle: string; fuente: React.CSSProperties }[] = [
  { v: "clasica", t: "Clásica", detalle: "Artesanal, cálida", fuente: { fontFamily: playfair.style.fontFamily, fontWeight: 400 } },
  { v: "elegante", t: "Elegante", detalle: "Fina, de boutique", fuente: { fontFamily: cormorant.style.fontFamily, fontWeight: 600 } },
  { v: "moderna", t: "Moderna", detalle: "Limpia, actual", fuente: { fontFamily: montserrat.style.fontFamily, fontWeight: 700 } },
  { v: "amigable", t: "Amigable", detalle: "Redondeada, cercana", fuente: { fontFamily: nunito.style.fontFamily, fontWeight: 800 } },
];

const ruido = (c: string) =>
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 ${c} 0 0 0 0 ${c} 0 0 0 0 ${c} 0 0 0 1 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;
const onda = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='22'%3E%3Cpath d='M0 11q16-10 32 0t32 0' fill='none' stroke='%23fff' stroke-width='1.2'/%3E%3C/svg%3E")`;

export const FONDOS: { v: Fondo; t: string }[] = [
  { v: "puntos", t: "Puntos" },
  { v: "lienzo", t: "Lienzo" },
  { v: "papel", t: "Papel" },
  { v: "rayas", t: "Rayas" },
  { v: "ondas", t: "Ondas" },
  { v: "liso", t: "Liso" },
];

/** Textura clara sobre la portada (como la dibuja la tienda). `escala` achica el dibujo para la miniatura. */
export function texturaPortada(fondo: Fondo, claro: string, escala = 1): React.CSSProperties {
  const px = (n: number) => `${n * escala}px`;
  switch (fondo) {
    case "puntos":
      return { backgroundImage: `radial-gradient(${claro} ${px(1)}, transparent ${px(1)})`, backgroundSize: `${px(14)} ${px(14)}`, opacity: 0.25 };
    case "lienzo":
      return { backgroundImage: `repeating-linear-gradient(0deg, ${claro} 0 1px, transparent 1px ${px(3)}), repeating-linear-gradient(90deg, ${claro} 0 1px, transparent 1px ${px(3)})`, opacity: 0.14 };
    case "papel":
      return { backgroundImage: ruido("1"), backgroundSize: `${px(180)} ${px(180)}`, opacity: 0.4 };
    case "rayas":
      return { backgroundImage: `repeating-linear-gradient(45deg, ${claro} 0 1px, transparent 1px ${px(14)})`, opacity: 0.22 };
    case "ondas":
      return { backgroundImage: onda, backgroundSize: `${px(64)} ${px(22)}`, opacity: 0.28 };
    default:
      return { opacity: 0 };
  }
}

export const BORDES: { v: Bordes; t: string; tarjeta: number; boton: number }[] = [
  { v: "redondeados", t: "Redondeados", tarjeta: 10, boton: 999 },
  { v: "suaves", t: "Suaves", tarjeta: 5, boton: 5 },
  { v: "rectos", t: "Rectos", tarjeta: 1, boton: 1 },
];

interface Props {
  fondo: Fondo;
  tipografia: Tipografia;
  bordes: Bordes;
  hero: string;
  crema: string;
  onCambio: (campo: "fondo" | "tipografia" | "bordes", valor: string) => void;
}

/** Pestaña Estilo: textura del fondo, tipografía de los títulos y forma de los bordes. */
export function OpcionesEstilo({ fondo, tipografia, bordes, hero, crema, onCambio }: Props) {
  const opcion = "rounded-lg ring-1 ring-foreground/15 transition hover:ring-foreground/40";
  const elegida = "ring-2 ring-primary hover:ring-primary";
  return (
    <>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Fondo de la portada</legend>
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
          {FONDOS.map((f) => {
            const textura = texturaPortada(f.v, crema);
            return (
              <button key={f.v} type="button" onClick={() => onCambio("fondo", f.v)} aria-pressed={fondo === f.v} className={cn("overflow-hidden text-xs", opcion, fondo === f.v && elegida)}>
                <span className="relative block h-9" style={{ background: hero }}>
                  {/* Más marcada que en la tienda para que se note en la miniatura. */}
                  <span className="absolute inset-0" style={{ ...textura, opacity: Math.min(1, Number(textura.opacity) * 2) }} />
                </span>
                <span className="block py-1">{f.t}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Tipografía de los títulos</legend>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {TIPOGRAFIAS.map((f) => (
            <button key={f.v} type="button" onClick={() => onCambio("tipografia", f.v)} aria-pressed={tipografia === f.v} title={f.detalle} className={cn("flex flex-col items-center gap-0.5 p-1.5", opcion, tipografia === f.v && elegida)}>
              <span className="text-2xl leading-tight" style={f.fuente} aria-hidden>
                Aa
              </span>
              <span className="text-xs font-medium">{f.t}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Bordes</legend>
        <div className="grid grid-cols-3 gap-1.5">
        {BORDES.map((b) => (
          <button key={b.v} type="button" onClick={() => onCambio("bordes", b.v)} aria-pressed={bordes === b.v} className={cn("flex items-center justify-center gap-2 px-2 py-1.5 text-xs", opcion, bordes === b.v && elegida)}>
            <span className="h-3.5 w-6 shrink-0 bg-foreground/70" style={{ borderRadius: b.boton === 999 ? 999 : b.boton * 1.5 }} aria-hidden />
            {b.t}
          </button>
        ))}
        </div>
      </fieldset>
    </>
  );
}

export const FORMAS_FOTO: { v: FormaFoto; t: string; aspecto: string }[] = [
  { v: "horizontal", t: "Horizontal", aspecto: "4 / 3" },
  { v: "cuadrada", t: "Cuadrada", aspecto: "1 / 1" },
  { v: "vertical", t: "Vertical", aspecto: "4 / 5" },
];

/** Forma de las fotos de producto y cuántos productos por fila en el celular. */
export function OpcionesFotos({ forma, columnas, onForma, onColumnas }: { forma: FormaFoto; columnas: number; onForma: (v: FormaFoto) => void; onColumnas: (v: number) => void }) {
  const opcion = "flex flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-xs ring-1 ring-foreground/15 transition hover:ring-foreground/40";
  const elegida = "ring-2 ring-primary hover:ring-primary";
  return (
    <div className="grid gap-4 sm:grid-cols-[3fr_2fr]">
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Forma de las fotos</legend>
        <div className="grid grid-cols-3 gap-1.5">
          {FORMAS_FOTO.map((f) => (
            <button key={f.v} type="button" onClick={() => onForma(f.v)} aria-pressed={forma === f.v} className={cn(opcion, forma === f.v && elegida)}>
              <span className="h-4 shrink-0 rounded-[2px] bg-foreground/60" style={{ aspectRatio: f.aspecto }} aria-hidden />
              {f.t}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">En el celular</legend>
        <div className="grid grid-cols-2 gap-1.5">
          {[1, 2].map((n) => (
            <button key={n} type="button" onClick={() => onColumnas(n)} aria-pressed={columnas === n} className={cn(opcion, columnas === n && elegida)}>
              <span className="flex gap-0.5" aria-hidden>
                {Array.from({ length: n }, (_, i) => (
                  <span key={i} className={cn("h-4 rounded-[2px] bg-foreground/60", n === 1 ? "w-4" : "w-2")} />
                ))}
              </span>
              {n === 1 ? "1 por fila" : "2 por fila"}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

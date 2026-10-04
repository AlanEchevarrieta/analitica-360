"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { ExternalLink, ImagePlus, Loader2, ShoppingCart, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiFetch } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { BORDES, FORMAS_FOTO, OpcionesEstilo, OpcionesFotos, TIPOGRAFIAS, texturaPortada, type Bordes, type Fondo, type FormaFoto, type Tipografia } from "./EstiloTienda";

interface Tienda {
  existe: boolean;
  base: string;
  activa: boolean;
  subdominio: string;
  dominioPropio: string | null;
  nombre: string;
  descripcion: string | null;
  color: string;
  logoUrl: string | null;
  whatsapp: string | null;
  instagram: string | null;
  textoEnvios: string | null;
  alias: string | null;
  cbu: string | null;
  titular: string | null;
  mostrarSinStock: boolean;
  fondo: Fondo;
  tipografia: Tipografia;
  bordes: Bordes;
  portadaUrl: string | null;
  anuncio: string | null;
  formaFoto: FormaFoto;
  columnasCelular: number;
  seccionesOcultas: Seccion[];
  tituloDestacados: string | null;
  sobreNosotros: string | null;
  horario: string | null;
  facebook: string | null;
  tiktok: string | null;
  pedidoMinimo: number | null;
  descuentoTransferencia: number;
}

type Seccion = "beneficios" | "categorias" | "destacados" | "sobre";
const SECCIONES: { v: Seccion; t: string }[] = [
  { v: "beneficios", t: "Beneficios (envíos, pago, WhatsApp)" },
  { v: "categorias", t: "Categorías" },
  { v: "destacados", t: "Destacados" },
  { v: "sobre", t: "Sobre nosotros" },
];

const CAMPOS = ["activa", "subdominio", "dominioPropio", "nombre", "descripcion", "color", "whatsapp", "instagram", "textoEnvios", "alias", "cbu", "titular", "mostrarSinStock", "fondo", "tipografia", "bordes", "anuncio", "formaFoto", "columnasCelular", "seccionesOcultas", "tituloDestacados", "sobreNosotros", "horario", "facebook", "tiktok", "pedidoMinimo", "descuentoTransferencia"] as const;
const PESTANAS = [
  { v: "marca", t: "Marca" },
  { v: "estilo", t: "Estilo" },
  { v: "portada", t: "Portada" },
  { v: "contacto", t: "Contacto" },
  { v: "cobros", t: "Cobros" },
  { v: "direccion", t: "Dirección" },
] as const;
type Pestana = (typeof PESTANAS)[number]["v"];

/** Colores que se leen bien en la tienda. */
const SUGERIDOS = ["#8a5a2b", "#b4532a", "#8c1c3a", "#5b3fa0", "#1e4e8c", "#0f766e", "#2f6b3b", "#2b2b2b"];

/** En desarrollo la tienda corre en el puerto 3010 (acacia.localhost:3010). */
const TIENDA_LOCAL = process.env.NEXT_PUBLIC_TIENDA_LOCAL_URL ?? "";

/* Mismos colores que arma la tienda a partir del color de marca (apps/tienda/app/globals.css). */
type Rgb = [number, number, number];
const aRgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) || 0) as Rgb;
const aHex = (c: Rgb) => `#${c.map((x) => x.toString(16).padStart(2, "0")).join("")}`;
const mezclar = (hex: string, parte: number, con: Rgb = [0, 0, 0]): Rgb => aRgb(hex).map((c, i) => Math.round(c * parte + con[i] * (1 - parte))) as Rgb;
const luminancia = (c: Rgb) => {
  const [r, g, b] = c.map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a: Rgb, b: Rgb) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
function coloresTienda(color: string) {
  const crema = mezclar(color, 0.07, [251, 250, 247]);
  return { marca: aRgb(color), oscuro: mezclar(color, 0.62), hero: mezclar(color, 0.78), crema };
}
/** El precio (color de marca sobre blanco) y los textos de la portada se tienen que poder leer. */
function seLeeBien(color: string) {
  const c = coloresTienda(color);
  return contraste(c.marca, [255, 255, 255]) >= 3 && contraste(c.crema, c.hero) >= 4.5;
}
function oscurecer(color: string) {
  let hex = color;
  for (let i = 0; i < 30 && !seLeeBien(hex); i++) hex = aHex(mezclar(hex, 0.92));
  return hex;
}

/** Tienda online del negocio: dirección, marca, contacto y datos para cobrar. */
export function TiendaOnlineConfig() {
  const api = useApiFetch();
  const { orgId } = useAuth();
  const { data } = useQuery({ queryKey: ["tienda-config", orgId], queryFn: () => api<Tienda>("/tienda-config"), enabled: Boolean(orgId) });
  if (!data) return <Loader2 className="mx-auto my-8 animate-spin text-muted-foreground" aria-label="Cargando" />;
  return <Formulario key={JSON.stringify(data)} inicial={data} />;
}

function Formulario({ inicial }: { inicial: Tienda }) {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  const logoInput = useRef<HTMLInputElement>(null);
  const portadaInput = useRef<HTMLInputElement>(null);
  const [t, setT] = useState(inicial);
  const [pestana, setPestana] = useState<Pestana>("marca");
  const [aviso, setAviso] = useState<string | null>(null);
  const set = <K extends keyof Tienda>(k: K, v: Tienda[K]) => setT((x) => ({ ...x, [k]: v }));
  const refrescar = () => void queryClient.invalidateQueries({ queryKey: ["tienda-config"] });
  const error = (e: unknown) => toast.error(e instanceof Error ? e.message : "No se pudo guardar");
  const normal = (v: unknown) => JSON.stringify(v === "" || v === undefined ? null : v);
  const hayCambios = CAMPOS.some((k) => normal(t[k]) !== normal(inicial[k]));

  const guardar = useMutation({
    mutationFn: () => api("/tienda-config", { method: "PUT", body: JSON.stringify(Object.fromEntries(CAMPOS.map((k) => [k, t[k]]))) }),
    onSuccess: () => (toast.success(t.activa ? "Guardado. Tu tienda se actualiza en unos segundos." : "Guardado. La tienda no está publicada."), refrescar()),
    onError: error,
  });
  // Logo y foto de portada: se suben (o quitan) al momento, sin esperar a "Guardar".
  const imagen = useMutation({
    mutationFn: ({ cual, archivo }: { cual: "logo" | "portada"; archivo: File | null }) => {
      if (!archivo) return api(`/tienda-config/${cual}`, { method: "DELETE" });
      const cuerpo = new FormData();
      cuerpo.append("archivo", archivo);
      return api(`/tienda-config/${cual}`, { method: "POST", body: cuerpo });
    },
    onSuccess: (_, { cual, archivo }) => (toast.success(`${cual === "logo" ? "Logo" : "Foto de portada"} ${archivo ? "actualizada" : "quitada"}`), refrescar()),
    onError: error,
  });
  const subiendo = (cual: "logo" | "portada") => imagen.isPending && imagen.variables?.cual === cual;

  async function revisarSubdominio() {
    if (t.subdominio === inicial.subdominio && inicial.existe) return setAviso(null);
    const r = await api<{ disponible: boolean; motivo: string | null }>(`/tienda-config/disponible?subdominio=${encodeURIComponent(t.subdominio)}`);
    setAviso(r.disponible ? null : r.motivo);
  }

  const campo = (k: keyof Tienda, etiqueta: string, extra: React.ComponentProps<typeof Input> = {}, ayuda?: string) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`tienda-${k}`}>{etiqueta}</Label>
      <Input id={`tienda-${k}`} value={(t[k] as string | null) ?? ""} onChange={(e) => set(k, e.target.value as never)} {...extra} />
      {ayuda && <span className="text-xs text-muted-foreground">{ayuda}</span>}
    </div>
  );
  const direccion = `${t.subdominio}.${inicial.base}`;
  const verLocal = TIENDA_LOCAL ? TIENDA_LOCAL.replace("{sub}", inicial.subdominio) : null;
  const colorOk = /^#[0-9a-f]{6}$/i.test(t.color) && seLeeBien(t.color);
  const faltaCobro = !t.alias && !t.cbu;
  const colores = coloresTienda(/^#[0-9a-f]{6}$/i.test(t.color) ? t.color : "#6366f1");

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-muted/40 p-3">
        <label className="flex items-center gap-2 font-medium">
          <input type="checkbox" className="size-4" checked={t.activa} onChange={(e) => set("activa", e.target.checked)} />
          Tienda publicada
        </label>
        <span className="text-muted-foreground">
          {t.activa ? "Visible en" : "Oculta · será"} <b className="text-foreground">{direccion}</b>
        </span>
        {inicial.existe && inicial.activa && verLocal && (
          <a href={verLocal} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "ml-auto")}>
            <ExternalLink aria-hidden /> Ver mi tienda
          </a>
        )}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <div role="tablist" aria-label="Partes de la tienda" className="flex gap-1 overflow-x-auto border-b">
            {PESTANAS.map((p) => {
              const alerta = (p.v === "direccion" && aviso) || (p.v === "marca" && !colorOk) || (p.v === "cobros" && faltaCobro);
              return (
                <button
                  key={p.v}
                  type="button"
                  role="tab"
                  aria-selected={pestana === p.v}
                  onClick={() => setPestana(p.v)}
                  className={cn("-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-2 py-2", pestana === p.v ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}
                >
                  {p.t}
                  {alerta && <span className="size-1.5 rounded-full bg-amber-500" aria-label="revisar" />}
                </button>
              );
            })}
          </div>

          <div role="tabpanel" className="flex min-h-64 flex-col gap-4">
            {pestana === "marca" && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  {campo("nombre", "Nombre que ven los clientes")}
                  {campo("descripcion", "Frase de presentación", { placeholder: "Mates, canastos y bolsos artesanales de Mendoza" })}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tienda-color">Color de la marca</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input id="tienda-color" type="color" className="h-8 w-12 cursor-pointer rounded border bg-transparent" value={t.color} onChange={(e) => set("color", e.target.value)} />
                    <span className="w-16 text-muted-foreground tabular-nums">{t.color}</span>
                    <span className="text-xs text-muted-foreground">Sugeridos:</span>
                    {SUGERIDOS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => set("color", c)}
                        aria-label={`Usar el color ${c}`}
                        className={cn("size-6 rounded-full ring-1 ring-foreground/15 transition hover:scale-110", t.color.toLowerCase() === c && "ring-2 ring-foreground ring-offset-2 ring-offset-background")}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                  {!colorOk && (
                    <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-300">
                      Este color es muy claro: los precios y los textos de la tienda se van a leer mal.
                      <Button type="button" size="xs" variant="outline" onClick={() => set("color", oscurecer(t.color))}>
                        <Wand2 aria-hidden /> Oscurecer lo justo
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex size-14 items-center justify-center overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10">
                    {/* eslint-disable-next-line @next/next/no-img-element -- logo subido por el usuario, de otro origen */}
                    {inicial.logoUrl ? <img src={inicial.logoUrl} alt="Logo" className="size-full object-contain" /> : <span className="text-xs text-muted-foreground">Sin logo</span>}
                  </div>
                  <Button variant="outline" size="sm" disabled={!inicial.existe || imagen.isPending} onClick={() => logoInput.current?.click()}>
                    {subiendo("logo") ? <Loader2 className="animate-spin" aria-hidden /> : <ImagePlus aria-hidden />} {inicial.logoUrl ? "Cambiar logo" : "Subir logo"}
                  </Button>
                  {inicial.logoUrl && (
                    <Button variant="ghost" size="icon-sm" aria-label="Quitar logo" disabled={imagen.isPending} onClick={() => window.confirm("¿Quitar el logo?") && imagen.mutate({ cual: "logo", archivo: null })}>
                      <Trash2 aria-hidden />
                    </Button>
                  )}
                  <span className="text-xs text-muted-foreground">{inicial.existe ? "JPG, PNG o WEBP. Mejor si es cuadrado o apaisado con fondo transparente." : "Guardá la tienda primero para subir el logo."}</span>
                  <input ref={logoInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Elegir logo" onChange={(e) => e.target.files?.[0] && imagen.mutate({ cual: "logo", archivo: e.target.files[0] })} />
                </div>
              </>
            )}

            {pestana === "estilo" && (
              <>
                <OpcionesEstilo
                  fondo={t.fondo}
                  tipografia={t.tipografia}
                  bordes={t.bordes}
                  hero={aHex(colores.hero)}
                  crema={aHex(colores.crema)}
                  onCambio={(k, v) => set(k, v as never)}
                />
                <OpcionesFotos forma={t.formaFoto} columnas={t.columnasCelular} onForma={(v) => set("formaFoto", v)} onColumnas={(v) => set("columnasCelular", v)} />
              </>
            )}

            {pestana === "portada" && (
              <>
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">Foto de portada (opcional)</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex h-12 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10">
                      {/* eslint-disable-next-line @next/next/no-img-element -- foto subida por el usuario, de otro origen */}
                      {inicial.portadaUrl ? <img src={inicial.portadaUrl} alt="Portada" className="size-full object-cover" /> : <span className="text-xs text-muted-foreground">Sin foto</span>}
                    </div>
                    <Button variant="outline" size="sm" disabled={!inicial.existe || imagen.isPending} onClick={() => portadaInput.current?.click()}>
                      {subiendo("portada") ? <Loader2 className="animate-spin" aria-hidden /> : <ImagePlus aria-hidden />} {inicial.portadaUrl ? "Cambiar" : "Subir foto"}
                    </Button>
                    {inicial.portadaUrl && (
                      <Button variant="ghost" size="icon-sm" aria-label="Quitar foto de portada" disabled={imagen.isPending} onClick={() => window.confirm("¿Quitar la foto de portada?") && imagen.mutate({ cual: "portada", archivo: null })}>
                        <Trash2 aria-hidden />
                      </Button>
                    )}
                    <span className="min-w-40 flex-1 text-xs text-muted-foreground">{inicial.existe ? "Horizontal y bien iluminada (ideal 1600×900). Va de fondo, con tu color encima." : "Guardá la tienda primero para subir la foto."}</span>
                    <input ref={portadaInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Elegir foto de portada" onChange={(e) => e.target.files?.[0] && imagen.mutate({ cual: "portada", archivo: e.target.files[0] })} />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {campo("anuncio", "Barra de anuncios (opcional)", { placeholder: "🚚 Envío gratis desde $50.000", maxLength: 120 })}
                  {campo("tituloDestacados", "Título de los destacados", { placeholder: "Los más elegidos", maxLength: 60 })}
                </div>
                <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <legend className="mb-1.5 text-sm font-medium">Secciones que se muestran</legend>
                  {SECCIONES.map((x) => (
                    <label key={x.v} className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={!t.seccionesOcultas.includes(x.v)}
                        onChange={(e) => set("seccionesOcultas", e.target.checked ? t.seccionesOcultas.filter((v) => v !== x.v) : [...t.seccionesOcultas, x.v])}
                      />
                      {x.t}
                    </label>
                  ))}
                </fieldset>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tienda-sobreNosotros">Texto de “Sobre nosotros” (opcional)</Label>
                  <textarea
                    id="tienda-sobreNosotros"
                    rows={3}
                    maxLength={1500}
                    value={t.sobreNosotros ?? ""}
                    onChange={(e) => set("sobreNosotros", e.target.value)}
                    placeholder="Contá tu historia: quiénes son, cómo hacen sus productos, qué los hace distintos."
                    className="rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                  />
                </div>
              </>
            )}

            {pestana === "contacto" && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  {campo("whatsapp", "WhatsApp para pedidos y consultas", { inputMode: "tel", placeholder: "261 5469432" }, "Con código de área, sin 0 ni 15. Ahí te llegan los pedidos.")}
                  {campo("instagram", "Instagram (opcional)", { placeholder: "minegocio" }, "Solo el usuario, sin @.")}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {campo("facebook", "Facebook (opcional)", { placeholder: "minegocio" })}
                  {campo("tiktok", "TikTok (opcional)", { placeholder: "minegocio" })}
                  {campo("horario", "Horario de atención", { placeholder: "Lun a sáb de 9 a 20" })}
                </div>
                {campo("textoEnvios", "Envíos y retiro", { placeholder: "Envíos a todo el país. Retiro en el local." }, "Se muestra en la portada y al pie de la tienda.")}
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={t.mostrarSinStock} onChange={(e) => set("mostrarSinStock", e.target.checked)} />
                  Mostrar también los productos sin stock (como “Sin stock”)
                </label>
              </>
            )}

            {pestana === "cobros" && (
              <>
                <p className="text-muted-foreground">Se muestran al cliente cuando confirma el pedido, con un botón para copiarlos. Por ahora no hay pago online: el cliente transfiere y te manda el comprobante por WhatsApp.</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {campo("alias", "Alias", { placeholder: "minegocio.mp" })}
                  {campo("cbu", "CBU / CVU", { inputMode: "numeric" })}
                  {campo("titular", "Titular")}
                </div>
                {faltaCobro && <p className="rounded-lg bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-300">Sin alias ni CBU el cliente no sabe a dónde transferir: le va a tener que escribir para preguntar.</p>}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tienda-pedidoMinimo">Compra mínima (opcional)</Label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">$</span>
                    <Input
                      id="tienda-pedidoMinimo"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={500}
                      className="max-w-40"
                      placeholder="Sin mínimo"
                      value={t.pedidoMinimo ?? ""}
                      onChange={(e) => set("pedidoMinimo", e.target.value === "" ? null : Math.max(0, Number(e.target.value)))}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">Si el carrito no llega a ese monto, la tienda avisa cuánto falta y no deja confirmar. Ideal para ventas mayoristas.</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tienda-descuentoTransferencia">Descuento por pagar con transferencia</Label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      id="tienda-descuentoTransferencia"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={50}
                      step={1}
                      className="max-w-24"
                      placeholder="0"
                      value={t.descuentoTransferencia || ""}
                      onChange={(e) => set("descuentoTransferencia", Math.min(50, Math.max(0, Number(e.target.value) || 0)))}
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                  <span className="text-xs text-muted-foreground">En el checkout el cliente elige &quot;Transferencia&quot; y ve el precio con este descuento (se aplica después del cupón). 0 = sin descuento. Los cupones están en Configuración → Cupones de la tienda.</span>
                </div>
              </>
            )}

            {pestana === "direccion" && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="tienda-subdominio">Dirección de la tienda</Label>
                    <div className="flex items-center gap-1">
                      <Input id="tienda-subdominio" className="max-w-48" value={t.subdominio} onChange={(e) => set("subdominio", e.target.value.toLowerCase())} onBlur={() => void revisarSubdominio()} />
                      <span className="text-muted-foreground">.{inicial.base}</span>
                    </div>
                    {aviso ? <span className="text-xs text-destructive">{aviso}</span> : <span className="text-xs text-muted-foreground">Se verá en {direccion}</span>}
                  </div>
                  {campo("dominioPropio", "Dominio propio (opcional)", { placeholder: "minegocio.com.ar" }, "Si ya tenés uno comprado.")}
                </div>
                {t.dominioPropio && <p className="text-xs text-muted-foreground">Para usar tu dominio, cuando la plataforma esté publicada te pasamos el registro DNS a cargar donde lo compraste (un paso de 5 minutos).</p>}
              </>
            )}
          </div>
        </div>

        <VistaPrevia t={t} logoUrl={inicial.logoUrl} portadaUrl={inicial.portadaUrl} />
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t pt-4">
        <Button onClick={() => guardar.mutate()} disabled={guardar.isPending || Boolean(aviso) || !hayCambios}>
          {guardar.isPending && <Loader2 className="animate-spin" aria-hidden />}
          Guardar tienda
        </Button>
        {hayCambios ? (
          <>
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Tenés cambios sin guardar</span>
            <Button variant="ghost" size="sm" onClick={() => (setT(inicial), setAviso(null))}>
              Descartar
            </Button>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">Todo guardado</span>
        )}
      </div>
    </div>
  );
}

/** Miniatura de la portada de la tienda con los datos que se están editando (sin guardar todavía). */
function VistaPrevia({ t, logoUrl, portadaUrl }: { t: Tienda; logoUrl: string | null; portadaUrl: string | null }) {
  const valido = /^#[0-9a-f]{6}$/i.test(t.color) ? t.color : "#6366f1";
  const c = coloresTienda(valido);
  const css = (x: Rgb) => aHex(x);
  const fuente = TIPOGRAFIAS.find((f) => f.v === t.tipografia)?.fuente;
  const borde = BORDES.find((b) => b.v === t.bordes) ?? BORDES[0];
  const aspecto = FORMAS_FOTO.find((f) => f.v === t.formaFoto)?.aspecto ?? "4 / 3";
  const nombre = t.nombre || "Tu negocio";
  return (
    <figure className="flex flex-col gap-1.5 max-lg:order-first lg:sticky lg:top-4">
      <figcaption className="text-xs font-medium text-muted-foreground">Así se ve tu tienda</figcaption>
      <div aria-hidden className="overflow-hidden rounded-lg shadow-sm ring-1 ring-foreground/10" style={{ background: css(c.crema), color: "#1f1a17" }}>
        {t.anuncio && (
          <p className="truncate px-2 py-1 text-center text-[8px] font-medium text-white" style={{ background: css(c.oscuro) }}>
            {t.anuncio}
          </p>
        )}
        <div className="flex items-center gap-1.5 border-b px-2.5 py-2" style={{ borderColor: `${css(c.oscuro)}26` }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- logo subido por el usuario, de otro origen */}
          {logoUrl && <img src={logoUrl} alt="" className="size-4 object-contain" />}
          <span className="flex-1 truncate text-[13px]" style={{ ...fuente, color: css(c.oscuro) }}>
            {nombre}
          </span>
          <ShoppingCart className="size-3" style={{ color: css(c.oscuro) }} />
        </div>
        <div className="relative isolate overflow-hidden px-3 py-5" style={{ background: css(c.hero), color: css(c.crema) }}>
          {portadaUrl && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- foto subida por el usuario, de otro origen */}
              <img src={portadaUrl} alt="" className="absolute inset-0 -z-10 size-full object-cover" />
              <span className="absolute inset-0 -z-10" style={{ background: `linear-gradient(90deg, ${css(c.hero)}eb 0%, ${css(c.hero)}b3 45%, ${css(c.hero)}26 100%)` }} />
            </>
          )}
          <span className="absolute inset-0 -z-10" style={texturaPortada(t.fondo, css(c.crema), 0.6)} />
          <p className="text-base leading-tight" style={fuente}>
            {nombre}
          </p>
          <p className="mt-1 line-clamp-2 text-[10px] opacity-90">{t.descripcion || "Tu frase de presentación"}</p>
          <span className="mt-2 inline-block px-2.5 py-1 text-[9px] font-semibold" style={{ background: css(c.crema), color: css(c.oscuro), borderRadius: borde.boton }}>
            Ver productos
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 p-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="overflow-hidden bg-white shadow-sm" style={{ borderRadius: borde.tarjeta * 0.6 }}>
              <div style={{ aspectRatio: aspecto, background: `${css(c.marca)}1a` }} />
              <div className="flex flex-col gap-0.5 p-1">
                <span className="text-[8px]" style={fuente}>
                  Producto
                </span>
                <span className="text-[9px] font-semibold" style={{ color: css(c.marca) }}>
                  $25.000
                </span>
                <span className="py-0.5 text-center text-[7px] text-white" style={{ background: css(c.oscuro), borderRadius: borde.boton }}>
                  Agregar
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <span className="text-[11px] text-muted-foreground">Se actualiza mientras editás. Los cambios llegan a la tienda al guardar.</span>
    </figure>
  );
}

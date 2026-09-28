"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { ExternalLink, ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiFetch } from "@/hooks/use-api";

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
}

/** En desarrollo la tienda corre en el puerto 3010 (acacia.localhost:3010). */
const TIENDA_LOCAL = process.env.NEXT_PUBLIC_TIENDA_LOCAL_URL ?? "";

/** Tienda online del negocio: dirección, marca, contacto y datos para cobrar. */
export function TiendaOnlineConfig() {
  const api = useApiFetch();
  const { orgId } = useAuth();
  const { data } = useQuery({ queryKey: ["tienda-config", orgId], queryFn: () => api<Tienda>("/tienda-config"), enabled: Boolean(orgId) });
  if (!data) return null;
  return <Formulario key={JSON.stringify(data)} inicial={data} />;
}

function Formulario({ inicial }: { inicial: Tienda }) {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  const logoInput = useRef<HTMLInputElement>(null);
  const [t, setT] = useState(inicial);
  const [aviso, setAviso] = useState<string | null>(null);
  const set = <K extends keyof Tienda>(k: K, v: Tienda[K]) => setT((x) => ({ ...x, [k]: v }));
  const refrescar = () => void queryClient.invalidateQueries({ queryKey: ["tienda-config"] });
  const error = (e: unknown) => toast.error(e instanceof Error ? e.message : "No se pudo guardar");

  const guardar = useMutation({
    mutationFn: () => {
      const campos: (keyof Tienda)[] = ["activa", "subdominio", "dominioPropio", "nombre", "descripcion", "color", "whatsapp", "instagram", "textoEnvios", "alias", "cbu", "titular", "mostrarSinStock"];
      return api("/tienda-config", { method: "PUT", body: JSON.stringify(Object.fromEntries(campos.map((k) => [k, t[k]]))) });
    },
    onSuccess: () => (toast.success(t.activa ? "Tienda guardada y publicada" : "Tienda guardada"), refrescar()),
    onError: error,
  });
  const logo = useMutation({
    mutationFn: (archivo: File) => {
      const cuerpo = new FormData();
      cuerpo.append("archivo", archivo);
      return api("/tienda-config/logo", { method: "POST", body: cuerpo });
    },
    onSuccess: () => (toast.success("Logo actualizado"), refrescar()),
    onError: error,
  });

  async function revisarSubdominio() {
    if (t.subdominio === inicial.subdominio && inicial.existe) return setAviso(null);
    const r = await api<{ disponible: boolean; motivo: string | null }>(`/tienda-config/disponible?subdominio=${encodeURIComponent(t.subdominio)}`);
    setAviso(r.disponible ? null : r.motivo);
  }

  const campo = (k: keyof Tienda, etiqueta: string, extra: React.ComponentProps<typeof Input> = {}) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`tienda-${k}`}>{etiqueta}</Label>
      <Input id={`tienda-${k}`} value={(t[k] as string | null) ?? ""} onChange={(e) => set(k, e.target.value as never)} {...extra} />
    </div>
  );
  const direccion = `${t.subdominio}.${inicial.base}`;
  const verLocal = TIENDA_LOCAL ? TIENDA_LOCAL.replace("{sub}", t.subdominio) : null;

  return (
    <div className="flex flex-col gap-4 text-sm">
      <label className="flex items-center gap-2 rounded-lg bg-muted/40 p-3">
        <input type="checkbox" checked={t.activa} onChange={(e) => set("activa", e.target.checked)} />
        <span>
          <b>Tienda publicada</b> — los clientes pueden ver el catálogo y hacer pedidos (llegan a Pedidos).
        </span>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tienda-subdominio">Dirección de la tienda</Label>
          <div className="flex items-center gap-1">
            <Input id="tienda-subdominio" className="max-w-48" value={t.subdominio} onChange={(e) => set("subdominio", e.target.value.toLowerCase())} onBlur={() => void revisarSubdominio()} />
            <span className="text-muted-foreground">.{inicial.base}</span>
          </div>
          {aviso ? <span className="text-xs text-destructive">{aviso}</span> : <span className="text-xs text-muted-foreground">Se verá en {direccion}</span>}
        </div>
        {campo("dominioPropio", "Dominio propio (opcional)", { placeholder: "minegocio.com.ar" })}
      </div>
      {t.dominioPropio && <p className="text-xs text-muted-foreground">Para usar tu dominio, cuando la plataforma esté publicada te pasamos el registro DNS a cargar donde lo compraste (un paso de 5 minutos).</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {campo("nombre", "Nombre que ven los clientes")}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tienda-color">Color de la marca</Label>
          <div className="flex items-center gap-2">
            <input id="tienda-color" type="color" className="h-8 w-12 cursor-pointer rounded border bg-transparent" value={t.color} onChange={(e) => set("color", e.target.value)} />
            <span className="text-muted-foreground tabular-nums">{t.color}</span>
          </div>
        </div>
      </div>
      {campo("descripcion", "Frase de presentación", { placeholder: "Mates, canastos y bolsos artesanales de Mendoza" })}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex size-16 items-center justify-center overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo subido por el usuario, de otro origen */}
          {inicial.logoUrl ? <img src={inicial.logoUrl} alt="Logo" className="size-full object-contain" /> : <span className="text-xs text-muted-foreground">Sin logo</span>}
        </div>
        <Button variant="outline" size="sm" disabled={!inicial.existe || logo.isPending} onClick={() => logoInput.current?.click()}>
          {logo.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <ImagePlus aria-hidden />} {inicial.logoUrl ? "Cambiar logo" : "Subir logo"}
        </Button>
        {!inicial.existe && <span className="text-xs text-muted-foreground">Guardá la tienda primero para subir el logo.</span>}
        <input ref={logoInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Elegir logo" onChange={(e) => e.target.files?.[0] && logo.mutate(e.target.files[0])} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {campo("whatsapp", "WhatsApp para consultas", { inputMode: "tel", placeholder: "261 5469432" })}
        {campo("instagram", "Instagram (opcional)", { placeholder: "minegocio" })}
      </div>
      {campo("textoEnvios", "Envíos y retiro", { placeholder: "Envíos a todo el país. Retiro en el local de lunes a sábado." })}

      <fieldset className="grid gap-3 rounded-lg p-3 ring-1 ring-foreground/10 sm:grid-cols-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">Datos para que te transfieran (se muestran al confirmar el pedido)</legend>
        {campo("alias", "Alias")}
        {campo("cbu", "CBU / CVU", { inputMode: "numeric" })}
        {campo("titular", "Titular")}
      </fieldset>

      <label className="flex items-center gap-2">
        <input type="checkbox" checked={t.mostrarSinStock} onChange={(e) => set("mostrarSinStock", e.target.checked)} />
        Mostrar también los productos sin stock (como “Sin stock”)
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => guardar.mutate()} disabled={guardar.isPending || Boolean(aviso)}>
          {guardar.isPending && <Loader2 className="animate-spin" aria-hidden />}
          Guardar tienda
        </Button>
        {inicial.existe && inicial.activa && verLocal && (
          <a href={verLocal} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline" })}>
            <ExternalLink aria-hidden /> Ver mi tienda
          </a>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Las fotos de cada producto se suben en su ficha (Productos → el producto → Fotos). Los insumos no se muestran nunca.</p>
    </div>
  );
}

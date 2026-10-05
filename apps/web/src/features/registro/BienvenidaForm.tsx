"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiFetch } from "@/hooks/use-api";
import { ORIGENES, RUBROS } from "@/lib/rubros";
import { CampoCodigo, useVerificarCodigo } from "./CampoCodigo";
import { codigoGuardado, olvidarCodigo } from "./codigo-guardado";

/** El código guardado no cambia mientras está la página abierta. */
const sinCambios = () => () => {};

const selectClase = "h-8 w-full rounded-lg border bg-transparent px-2 text-sm";
const INCLUYE = ["Ventas, stock y clientes desde el celular", "Reportes de ganancia y estados contables", "Sin tarjeta: no se cobra nada durante la prueba"];

/** Alta del negocio: crea la empresa con su prueba gratis (14 días, o lo que dé su código) y entra a la app. */
export function BienvenidaForm() {
  const api = useApiFetch({ permitirPendiente: true });
  const { setActive } = useClerk();
  const router = useRouter();
  const [d, setD] = useState({ nombre: "", rubro: "", telefono: "", origen: "", codigo: "", cuit: "", acepta: false });
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Vino con un link de recomendación: el código ya aparece puesto (hasta que lo cambie).
  const delLink = useSyncExternalStore(sinCambios, codigoGuardado, () => "");
  const [codigoTocado, setCodigoTocado] = useState(false);
  const textoCodigo = codigoTocado ? d.codigo : d.codigo || delLink;
  const { resultado: codigo, buscando } = useVerificarCodigo(textoCodigo);
  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => {
    setD((x) => ({ ...x, [k]: v }));
    setError(null);
  };

  function validar() {
    if (d.nombre.trim().length < 2) return "Poné el nombre de tu negocio.";
    if (!d.rubro) return "Elegí a qué se dedica tu negocio.";
    if (d.telefono.replace(/\D/g, "").length < 8) return "Dejanos un WhatsApp con código de área (ej. 261 5469432).";
    if (d.cuit.trim() && d.cuit.replace(/\D/g, "").length !== 11) return "El CUIT tiene que tener 11 números (o dejalo vacío).";
    if (textoCodigo.trim() && buscando) return "Esperá un segundo: estamos verificando el código.";
    if (textoCodigo.trim() && codigo && !codigo.ok) return "Ese código no sirve: corregilo o borralo para seguir sin código.";
    if (!d.acepta) return "Para seguir tenés que aceptar los términos y condiciones.";
    return null;
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const problema = validar();
    setError(problema);
    if (problema) return;
    setEnviando(true);
    try {
      const r = await api<{ clerkOrgId: string }>("/registro", {
        method: "POST",
        body: JSON.stringify({
          nombreNegocio: d.nombre,
          rubro: d.rubro,
          telefono: d.telefono,
          origen: d.origen || null,
          codigo: textoCodigo.trim() || null,
          cuit: d.cuit.trim() || null,
          aceptaTerminos: true,
        }),
      });
      // La empresa nueva pasa a ser la activa de la sesión (la API la exige en cada pedido).
      await setActive({ organization: r.clerkOrgId });
      olvidarCodigo();
      router.replace("/inicio?bienvenida=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos crear tu negocio. Probá de nuevo.");
      setEnviando(false);
    }
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="text-xl">¡Bienvenido/a a Analítica 360!</CardTitle>
        <CardDescription>
          Contanos de tu negocio y empezás tu prueba gratis de {codigo?.ok && codigo.mesGratis && codigo.diasPrueba ? `${codigo.diasPrueba} días` : "14 días"} con todas las funciones.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reg-nombre">Nombre del negocio</Label>
            <Input id="reg-nombre" autoFocus placeholder="Ej. Acacia Mates" value={d.nombre} onChange={(e) => set("nombre", e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reg-rubro">¿A qué se dedica?</Label>
            <select id="reg-rubro" className={selectClase} value={d.rubro} onChange={(e) => set("rubro", e.target.value)}>
              <option value="">Elegir…</option>
              {RUBROS.map((r) => (
                <option key={r.valor} value={r.valor}>
                  {r.etiqueta}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reg-telefono">Tu WhatsApp</Label>
              <Input id="reg-telefono" inputMode="tel" placeholder="261 5469432" value={d.telefono} onChange={(e) => set("telefono", e.target.value)} />
              <span className="text-xs text-muted-foreground">Para ayudarte a arrancar.</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reg-origen">¿Cómo nos conociste? (opcional)</Label>
              <select id="reg-origen" className={selectClase} value={d.origen} onChange={(e) => set("origen", e.target.value)}>
                <option value="">—</option>
                {ORIGENES.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <CampoCodigo
            valor={textoCodigo}
            onChange={(v) => {
              setCodigoTocado(true);
              set("codigo", v);
            }}
            resultado={codigo}
            buscando={buscando}
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reg-cuit">CUIT (opcional)</Label>
            <Input id="reg-cuit" inputMode="numeric" placeholder="20-12345678-9" value={d.cuit} onChange={(e) => set("cuit", e.target.value)} />
          </div>
          <ul className="flex flex-col gap-1 rounded-lg bg-muted/50 p-3 text-sm">
            {INCLUYE.map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Check className="size-4 text-primary" aria-hidden /> {t}
              </li>
            ))}
          </ul>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5" checked={d.acepta} onChange={(e) => set("acepta", e.target.checked)} />
            <span>
              Acepto los{" "}
              <Link href="/terminos" target="_blank" className="underline">
                términos y condiciones
              </Link>
              .
            </span>
          </label>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" disabled={enviando}>
            {enviando && <Loader2 className="animate-spin" aria-hidden />}
            Empezar mi prueba gratis
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { CheckCircle2, Circle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiFetch } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

interface RespuestaPasos {
  pasos: { productos: boolean; venta: boolean; compra: boolean; equipo: boolean; datosFiscales: boolean };
  hechos: number;
  total: number;
  mostrar: boolean;
}

const PASOS: { clave: keyof RespuestaPasos["pasos"]; titulo: string; detalle: string; href: string; accion: string }[] = [
  { clave: "productos", titulo: "Cargá tus productos", detalle: "Uno por uno o todos juntos desde Excel.", href: "/productos/importar", accion: "Importar Excel" },
  { clave: "venta", titulo: "Registrá tu primera venta", detalle: "Desde el celular, en segundos.", href: "/ventas/nueva", accion: "Nueva venta" },
  { clave: "compra", titulo: "Cargá una compra", detalle: "Así el stock y la ganancia son exactos.", href: "/compras/nueva", accion: "Nueva compra" },
  { clave: "datosFiscales", titulo: "Completá tus datos fiscales", detalle: "Monotributo y categoría para las alertas de tope.", href: "/configuracion", accion: "Configurar" },
  { clave: "equipo", titulo: "Invitá a tu equipo", detalle: "Cada uno con su usuario y permisos.", href: "/configuracion", accion: "Invitar" },
];

const CLAVE_OCULTO = "a360-primeros-pasos-oculto";
const sinSuscripcion = () => () => {};
function leerOculto() {
  try {
    return localStorage.getItem(CLAVE_OCULTO) === "1";
  } catch {
    return false;
  }
}

/** Guía de arranque para empresas nuevas (se va sola al completarla o al mes). */
export function PrimerosPasos({ bienvenida }: { bienvenida: boolean }) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  const oculto = useSyncExternalStore(sinSuscripcion, leerOculto, () => true);
  const [cerrado, setCerrado] = useState(false);
  const { data } = useQuery({
    queryKey: ["primeros-pasos", orgId],
    queryFn: () => api<RespuestaPasos>("/registro/primeros-pasos"),
    enabled: Boolean(orgId),
    staleTime: 60_000,
  });
  if (!data?.mostrar || cerrado || (oculto && !bienvenida)) return null;

  return (
    <Card className="ring-primary/40">
      <CardHeader className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle>{bienvenida ? "¡Listo! Tu prueba gratis de 14 días ya empezó" : "Primeros pasos"}</CardTitle>
          <CardDescription>
            {data.hechos} de {data.total} hechos · así en unos minutos ya ves tus números
          </CardDescription>
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Ocultar primeros pasos"
          onClick={() => {
            setCerrado(true);
            try {
              localStorage.setItem(CLAVE_OCULTO, "1");
            } catch {
              /* sin storage: vuelve a aparecer la próxima vez */
            }
          }}
        >
          <X />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={data.total} aria-valuenow={data.hechos}>
          <div className="h-full bg-primary transition-all" style={{ width: `${(data.hechos / data.total) * 100}%` }} />
        </div>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {PASOS.map((p) => {
            const hecho = data.pasos[p.clave];
            return (
              <li key={p.clave} className={cn("flex flex-col gap-1 rounded-lg p-3 ring-1 ring-foreground/10", hecho && "opacity-60")}>
                <span className="flex items-center gap-1.5 font-medium">
                  {hecho ? <CheckCircle2 className="size-4 text-primary" aria-label="Hecho" /> : <Circle className="size-4 text-muted-foreground" aria-hidden />}
                  {p.titulo}
                </span>
                <span className="text-xs text-muted-foreground">{p.detalle}</span>
                {!hecho && (
                  <Link href={p.href} className="mt-auto pt-1 text-sm font-medium text-primary hover:underline">
                    {p.accion} →
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

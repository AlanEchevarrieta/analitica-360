"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGuardarProveedor, type DatosProveedor, type Proveedor } from "../hooks/use-proveedores";

type Texto = Exclude<keyof DatosProveedor, "formasPagoAceptadas" | "activo">;
const VACIO: DatosProveedor = {
  nombre: "", razonSocial: null, nombreComercial: null, cuit: null, condicionAfip: null, nombreVendedor: null, telefono: null,
  email: null, productosQueProvee: null, condicionesPago: null, formasPagoAceptadas: [], plazoEntrega: null, cbu: null,
  aliasCbu: null, banco: null, notas: null, activo: true,
};
const CONDICIONES_AFIP = ["Responsable Inscripto", "Monotributista", "Exento", "Consumidor Final"];

/** CUIT de 11 dígitos con dígito verificador (algoritmo de AFIP). */
function cuitValido(cuit: string) {
  const d = cuit.replace(/\D/g, "");
  if (d.length !== 11) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((acc, p, i) => acc + p * Number(d[i]), 0);
  const resto = 11 - (suma % 11);
  const verificador = resto === 11 ? 0 : resto === 10 ? 9 : resto;
  return verificador === Number(d[10]);
}

export function ProveedorForm({ inicial, onHecho }: { inicial: Proveedor | null; onHecho?: () => void }) {
  const router = useRouter();
  const guardar = useGuardarProveedor();
  const [d, setD] = useState<DatosProveedor>(() => {
    if (!inicial) return VACIO;
    const { id: _id, ...datos } = inicial;
    void _id;
    return datos;
  });
  const set = (k: Texto, v: string) => setD((x) => ({ ...x, [k]: k === "nombre" ? v : v || null }));

  function enviar() {
    if (!d.nombre.trim()) return toast.error("El nombre es obligatorio.");
    if (d.cuit && !cuitValido(d.cuit)) return toast.error("El CUIT no es válido (revisá los 11 dígitos).");
    guardar.mutate(
      { id: inicial?.id ?? null, datos: { ...d, nombre: d.nombre.trim() } },
      {
        onSuccess: (p) => {
          toast.success(inicial ? "Proveedor guardado" : `Proveedor ${p.nombre} creado`);
          if (onHecho) onHecho();
          else router.push(`/proveedores/${p.id}`);
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo guardar"),
      },
    );
  }

  const campo = (k: Texto, etiqueta: string, extra?: Partial<React.ComponentProps<typeof Input>>) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`prov-${k}`}>{etiqueta}</Label>
      <Input id={`prov-${k}`} value={d[k] ?? ""} onChange={(e) => set(k, e.target.value)} {...extra} />
    </div>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Contacto</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {campo("nombre", "Nombre")}
          <div className="grid grid-cols-2 gap-3">
            {campo("nombreVendedor", "Vendedor / contacto")}
            {campo("telefono", "Teléfono (WhatsApp)", { inputMode: "tel" })}
          </div>
          {campo("email", "Email", { type: "email" })}
          {campo("productosQueProvee", "Qué provee", { placeholder: "Mates de calabaza, bombillas…" })}
          {campo("plazoEntrega", "Plazo de entrega", { placeholder: "7 días" })}
          {campo("notas", "Notas")}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={d.activo} onChange={(e) => setD((x) => ({ ...x, activo: e.target.checked }))} />
            Activo
          </label>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Datos fiscales y de pago</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {campo("razonSocial", "Razón social")}
          <div className="grid grid-cols-2 gap-3">
            {campo("cuit", "CUIT", { placeholder: "20-12345678-9", inputMode: "numeric" })}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prov-condicionAfip">Condición frente al IVA</Label>
              <select id="prov-condicionAfip" className="h-8 rounded-lg border bg-transparent px-2 text-sm" value={d.condicionAfip ?? ""} onChange={(e) => set("condicionAfip", e.target.value)}>
                <option value="">—</option>
                {CONDICIONES_AFIP.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          {campo("condicionesPago", "Condiciones de pago", { placeholder: "Contado, 30 días, 50% adelantado…" })}
          <div className="grid grid-cols-2 gap-3">
            {campo("aliasCbu", "Alias")}
            {campo("banco", "Banco")}
          </div>
          {campo("cbu", "CBU / CVU", { inputMode: "numeric" })}
          <Button className="self-start" onClick={enviar} disabled={guardar.isPending}>
            {inicial ? "Guardar cambios" : "Crear proveedor"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

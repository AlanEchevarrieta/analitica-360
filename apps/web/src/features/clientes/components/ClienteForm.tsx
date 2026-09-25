"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccionesClientes, type Cliente } from "../hooks/use-clientes";

/** Alta (inicial = null) o edición de un cliente. */
export function ClienteForm({ inicial, onHecho }: { inicial: Cliente | null; onHecho?: () => void }) {
  const router = useRouter();
  const { guardar } = useAccionesClientes();
  const [d, setD] = useState({
    nombre: inicial?.nombre ?? "",
    telefono: inicial?.telefono ?? "",
    email: inicial?.email ?? "",
    cumpleanos: inicial?.cumpleanos ?? "",
    etiquetas: inicial?.etiquetas.join(", ") ?? "",
    notas: inicial?.notasLibres ?? "",
  });
  const set = (k: keyof typeof d, v: string) => setD((x) => ({ ...x, [k]: v }));

  function enviar() {
    if (!d.nombre.trim()) return toast.error("El nombre es obligatorio.");
    if (d.email.trim() && !/^\S+@\S+\.\S+$/.test(d.email.trim())) return toast.error("El email no es válido.");
    guardar.mutate(
      {
        id: inicial?.id ?? null,
        datos: {
          nombre: d.nombre.trim(),
          telefono: d.telefono.trim() || null,
          email: d.email.trim() || null,
          cumpleanos: d.cumpleanos || null,
          notasLibres: d.notas.trim() || null,
          etiquetas: d.etiquetas.split(",").map((e) => e.trim()).filter(Boolean),
        },
      },
      {
        onSuccess: (c) => {
          toast.success(inicial ? "Cliente guardado" : `Cliente ${c.nombre} creado`);
          if (onHecho) onHecho();
          else router.push(`/clientes/${c.id}`);
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo guardar"),
      },
    );
  }

  const campo = (k: keyof typeof d, etiqueta: string, extra?: Partial<React.ComponentProps<typeof Input>>) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`cliente-${k}`}>{etiqueta}</Label>
      <Input id={`cliente-${k}`} value={d[k]} onChange={(e) => set(k, e.target.value)} {...extra} />
    </div>
  );

  return (
    <div className="flex max-w-xl flex-col gap-3">
      {campo("nombre", "Nombre", { autoFocus: !inicial })}
      <div className="grid grid-cols-2 gap-3">
        {campo("telefono", "Teléfono (WhatsApp)", { inputMode: "tel" })}
        {campo("email", "Email", { type: "email" })}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {campo("cumpleanos", "Cumpleaños", { type: "date" })}
        {campo("etiquetas", "Etiquetas", { placeholder: "mayorista, feria, instagram" })}
      </div>
      {campo("notas", "Notas", { placeholder: "Preferencias, talle, cómo nos conoció…" })}
      <Button className="self-start" onClick={enviar} disabled={guardar.isPending}>
        {inicial ? "Guardar cambios" : "Crear cliente"}
      </Button>
    </div>
  );
}

import { UsoVista } from "@/features/admin/components/UsoVista";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Uso de la app</h1>
        <p className="text-sm text-muted-foreground">Qué pantallas abren tus clientes, qué tocan, cuántas veces y quiénes. Solo nombres de pantallas y botones, nunca lo que escriben.</p>
      </div>
      <UsoVista />
    </div>
  );
}

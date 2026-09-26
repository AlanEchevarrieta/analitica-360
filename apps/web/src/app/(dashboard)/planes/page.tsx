import { PlanesVista } from "@/features/planes/components/PlanesVista";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Planes</h1>
        <p className="text-sm text-muted-foreground">Elegí el que mejor se adapte a tu negocio.</p>
      </div>
      <PlanesVista />
    </div>
  );
}

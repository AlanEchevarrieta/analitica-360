import { ImportarProductosVista } from "@/features/productos/components/ImportarProductosVista";

export default function Page() {
  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Importar productos</h1>
        <p className="text-sm text-muted-foreground">Cargá todo tu catálogo de una vez desde Excel.</p>
      </div>
      <ImportarProductosVista />
    </div>
  );
}

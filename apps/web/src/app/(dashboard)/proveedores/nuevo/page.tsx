import { ProveedorForm } from "@/features/proveedores/components/ProveedorForm";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Nuevo proveedor</h1>
      <ProveedorForm inicial={null} />
    </div>
  );
}

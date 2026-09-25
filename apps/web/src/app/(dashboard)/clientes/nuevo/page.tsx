import { ClienteForm } from "@/features/clientes/components/ClienteForm";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Nuevo cliente</h1>
      <ClienteForm inicial={null} />
    </div>
  );
}

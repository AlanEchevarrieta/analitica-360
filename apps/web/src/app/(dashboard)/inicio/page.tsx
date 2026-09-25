import { InicioDashboard } from "@/features/dashboard/components/InicioDashboard";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Inicio</h1>
      <InicioDashboard />
    </div>
  );
}

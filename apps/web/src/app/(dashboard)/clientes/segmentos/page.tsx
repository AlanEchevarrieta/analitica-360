import { SegmentosDifusion } from "@/features/clientes/components/SegmentosDifusion";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Segmentos y difusiones</h1>
      <SegmentosDifusion />
    </div>
  );
}

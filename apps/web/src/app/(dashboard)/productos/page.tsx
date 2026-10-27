import { Suspense } from "react";
import { ProductosVista } from "@/features/productos/components/ProductosVista";

export default function Page() {
  return (
    <Suspense>
      <ProductosVista />
    </Suspense>
  );
}


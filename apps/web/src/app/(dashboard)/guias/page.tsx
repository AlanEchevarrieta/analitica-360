import type { Metadata } from "next";
import { GuiasHub } from "@/features/guias/components/GuiasHub";

export const metadata: Metadata = {
  title: "Guías y Manuales Operativos | Analítica 360",
  description:
    "Bóveda interactiva de manuales de usuario, procesos paso a paso y casos de uso de Analítica 360.",
};

export default function GuiasPage() {
  return <GuiasHub />;
}

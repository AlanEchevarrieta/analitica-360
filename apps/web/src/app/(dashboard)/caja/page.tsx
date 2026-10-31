import type { Metadata } from "next";
import { CajaVista } from "@/features/caja/components/CajaVista";

export const metadata: Metadata = {
  title: "Control de Cajas y Turnos · Analítica 360",
  description: "Apertura de turno, sangrías, arqueo ciego y reportes X/Z para comanderas.",
};

export default function CajaPage() {
  return <CajaVista />;
}

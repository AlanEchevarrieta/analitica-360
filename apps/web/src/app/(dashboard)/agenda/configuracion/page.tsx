import { redirect } from "next/navigation";

/** Profesionales y horarios ahora vive en Configuración (grupo "Turnos y servicios"). */
export default function Page() {
  redirect("/configuracion?s=agenda");
}

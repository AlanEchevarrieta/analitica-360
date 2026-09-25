import { redirect } from "next/navigation";

// Mientras se portan las demás vistas de Analytics, la entrada del menú
// abre el reporte de ganancia por producto.
export default function Page() {
  redirect("/analytics/productos");
}

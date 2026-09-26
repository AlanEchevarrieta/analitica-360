import type { Metadata } from "next";
import { PaginaLegal, Seccion } from "@/components/shared/pagina-legal";

export const metadata: Metadata = { title: "Términos y condiciones · Analítica 360" };

/** Versión que se registra al aceptar (API: registro propio). Cambiar el texto = nueva versión. */
const VERSION_TERMINOS = "1.1";

export default function Page() {
  return (
    <PaginaLegal titulo="Términos y Condiciones de Uso" version={`Versión ${VERSION_TERMINOS} — Vigente desde septiembre de 2026.`}>
      <Seccion titulo="1. Servicio">
        Analítica 360 es una plataforma SaaS de gestión comercial para pequeñas y medianas empresas con sede en Mendoza, Argentina. El servicio incluye registro de ventas, compras, inventario,
        clientes y reportes analíticos.
      </Seccion>
      <Seccion titulo="2. Cuenta y responsabilidad">
        El usuario es responsable de mantener la confidencialidad de sus credenciales. Cada empresa registrada es una cuenta independiente con datos aislados de otras empresas.
      </Seccion>
      <Seccion titulo="3. Datos y privacidad">
        Los datos ingresados por el usuario son de su exclusiva propiedad. Analítica 360 no comercializa, cede ni vende datos de sus clientes a terceros. Los datos se almacenan en servidores de
        proveedores de infraestructura en la nube, con conexiones encriptadas. Más detalle en la Política de privacidad.
      </Seccion>
      <Seccion titulo="4. Planes y pagos">
        El servicio incluye un período de prueba gratuito de 14 días. Transcurrido ese período, el acceso requiere la contratación de un plan pago. Los precios están expresados en pesos argentinos
        (ARS) y pueden actualizarse con previo aviso de 30 días.
      </Seccion>
      <Seccion titulo="5. Cancelación">
        El usuario puede cancelar su suscripción en cualquier momento. No se realizan reembolsos por períodos ya facturados. Los datos se conservan por 30 días tras la cancelación para posible
        reactivación.
      </Seccion>
      <Seccion titulo="6. Limitación de responsabilidad">
        Analítica 360 no es responsable por pérdidas de datos ocasionadas por mal uso de la plataforma, problemas de conectividad del usuario, o eventos de fuerza mayor. Se recomienda exportar
        respaldos periódicamente.
      </Seccion>
      <Seccion titulo="7. Jurisdicción">
        Cualquier disputa se resolverá bajo la legislación argentina vigente, con jurisdicción en los tribunales ordinarios de la Ciudad de Mendoza.
      </Seccion>
    </PaginaLegal>
  );
}

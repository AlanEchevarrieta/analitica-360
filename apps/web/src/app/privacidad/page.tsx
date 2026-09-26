import type { Metadata } from "next";
import { PaginaLegal, Seccion } from "@/components/shared/pagina-legal";

export const metadata: Metadata = { title: "Política de privacidad · Analítica 360" };

const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_CONTACT;

export default function Page() {
  return (
    <PaginaLegal titulo="Política de Privacidad" version="Versión 1.1">
      <Seccion titulo="¿Qué datos recopilamos?">
        Email y nombre del titular de la cuenta, WhatsApp de contacto, nombre de la empresa, rubro, y todos los datos comerciales que el usuario ingresa voluntariamente (ventas, productos, clientes,
        etc.).
      </Seccion>
      <Seccion titulo="¿Para qué los usamos?">
        Exclusivamente para proveer el servicio contratado y dar soporte. No utilizamos los datos para publicidad, perfilado ni ningún fin ajeno al servicio.
      </Seccion>
      <Seccion titulo="¿Dónde se almacenan?">En servidores de proveedores de infraestructura en la nube, con conexiones encriptadas.</Seccion>
      <Seccion titulo="¿Con quién los compartimos?">
        Con ningún tercero, salvo requerimiento judicial o legal expreso. El inicio de sesión lo gestiona Clerk (proveedor de autenticación), que guarda el email y la contraseña del usuario.
      </Seccion>
      <Seccion titulo="¿Por cuánto tiempo?">
        Mientras la cuenta esté activa, más 30 días tras la cancelación. El usuario puede solicitar la eliminación total de sus datos en cualquier momento por los medios de contacto indicados abajo.
      </Seccion>
      <Seccion titulo="Contacto">
        {WHATSAPP ? (
          <a className="underline" href={`https://wa.me/${WHATSAPP}`}>
            WhatsApp +{WHATSAPP}
          </a>
        ) : (
          "Desde la sección Soporte de la app."
        )}
      </Seccion>
    </PaginaLegal>
  );
}

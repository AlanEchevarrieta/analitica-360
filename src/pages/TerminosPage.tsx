import { LegalLayout } from './LegalLayout'

export function TerminosPage() {
  return (
    <LegalLayout title="Términos y Condiciones de Uso">
      <p>Versión 1.0 — Vigente desde septiembre de 2026.</p>
      <section>
        <h2 className="mb-1 font-bold text-[#1A2F4A]">1. Servicio</h2>
        <p>
          Analítica 360 es una plataforma SaaS de gestión comercial para pequeñas y medianas
          empresas con sede en Mendoza, Argentina. El servicio incluye registro de ventas,
          compras, inventario, clientes y reportes analíticos.
        </p>
      </section>
      <section>
        <h2 className="mb-1 font-bold text-[#1A2F4A]">2. Cuenta y responsabilidad</h2>
        <p>
          El usuario es responsable de mantener la confidencialidad de sus credenciales. Cada
          empresa registrada es una cuenta independiente con datos aislados de otras empresas.
        </p>
      </section>
      <section>
        <h2 className="mb-1 font-bold text-[#1A2F4A]">3. Datos y privacidad</h2>
        <p>
          Los datos ingresados por el usuario son de su exclusiva propiedad. Analítica 360 no
          comercializa, cede ni vende datos de sus clientes a terceros. Los datos se almacenan
          en servidores de Supabase (AWS São Paulo, Brasil) bajo estándares de seguridad SOC 2.
        </p>
      </section>
      <section>
        <h2 className="mb-1 font-bold text-[#1A2F4A]">4. Planes y pagos</h2>
        <p>
          El servicio incluye un período de prueba gratuito de 14 días. Transcurrido ese período,
          el acceso requiere la contratación de un plan pago. Los precios están expresados en
          pesos argentinos (ARS) y pueden actualizarse con previo aviso de 30 días.
        </p>
      </section>
      <section>
        <h2 className="mb-1 font-bold text-[#1A2F4A]">5. Cancelación</h2>
        <p>
          El usuario puede cancelar su suscripción en cualquier momento. No se realizan reembolsos
          por períodos ya facturados. Los datos se conservan por 30 días tras la cancelación para
          posible reactivación.
        </p>
      </section>
      <section>
        <h2 className="mb-1 font-bold text-[#1A2F4A]">6. Limitación de responsabilidad</h2>
        <p>
          Analítica 360 no es responsable por pérdidas de datos ocasionadas por mal uso de la
          plataforma, problemas de conectividad del usuario, o eventos de fuerza mayor. Se
          recomienda exportar respaldos periódicamente.
        </p>
      </section>
      <section>
        <h2 className="mb-1 font-bold text-[#1A2F4A]">7. Jurisdicción</h2>
        <p>
          Cualquier disputa se resolverá bajo la legislación argentina vigente, con jurisdicción
          en los tribunales ordinarios de la Ciudad de Mendoza.
        </p>
      </section>
    </LegalLayout>
  )
}

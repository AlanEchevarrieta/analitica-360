import { LegalLayout } from './LegalLayout'

export function PrivacidadPage() {
  return (
    <LegalLayout title="Política de Privacidad">
      <p>Versión 1.0</p>
      <section>
        <h2 className="mb-1 font-bold text-[#1A2F4A]">¿Qué datos recopilamos?</h2>
        <p>
          Email del titular de la cuenta, nombre de la empresa, rubro, y todos los datos
          comerciales que el usuario ingresa voluntariamente (ventas, productos, clientes, etc.).
        </p>
      </section>
      <section>
        <h2 className="mb-1 font-bold text-[#1A2F4A]">¿Para qué los usamos?</h2>
        <p>
          Exclusivamente para proveer el servicio contratado. No utilizamos los datos para
          publicidad, perfilado ni ningún fin ajeno al servicio.
        </p>
      </section>
      <section>
        <h2 className="mb-1 font-bold text-[#1A2F4A]">¿Dónde se almacenan?</h2>
        <p>
          En servidores de Supabase ubicados en São Paulo, Brasil, bajo certificación SOC 2 Type
          II y encriptación en reposo y en tránsito.
        </p>
      </section>
      <section>
        <h2 className="mb-1 font-bold text-[#1A2F4A]">¿Con quién los compartimos?</h2>
        <p>Con ningún tercero, salvo requerimiento judicial o legal expreso.</p>
      </section>
      <section>
        <h2 className="mb-1 font-bold text-[#1A2F4A]">¿Por cuánto tiempo?</h2>
        <p>
          Mientras la cuenta esté activa, más 30 días tras la cancelación. El usuario puede
          solicitar la eliminación total de sus datos en cualquier momento escribiendo a [email de
          contacto].
        </p>
      </section>
      <section>
        <h2 className="mb-1 font-bold text-[#1A2F4A]">Contacto</h2>
        <p>[email de Alan/empresa]</p>
      </section>
    </LegalLayout>
  )
}

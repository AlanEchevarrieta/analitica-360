import { Resend } from 'resend'

const resend = new Resend(import.meta.env.VITE_RESEND_API_KEY)

export async function enviarEmailInvitacion(
  emailDestino: string,
  nombreEmpresa: string,
  linkInvitacion: string,
) {
  return resend.emails.send({
    from: 'Analítica 360 <hola@analitica360.app>',
    to: emailDestino,
    subject: `Te invitaron a unirte a ${nombreEmpresa} en Analítica 360`,
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #6366F1; padding: 32px; text-align: center;">
          <h1 style="color: white; margin: 0;">Analítica 360</h1>
        </div>
        <div style="padding: 32px;">
          <h2>Te invitaron a unirte a ${nombreEmpresa}</h2>
          <p>Hacé clic en el botón para aceptar la invitación:</p>
          <a href="${linkInvitacion}"
             style="background: #6366F1; color: white; padding: 14px 28px;
                    border-radius: 8px; text-decoration: none; display: inline-block;
                    font-weight: 600; margin: 16px 0;">
            Aceptar invitación
          </a>
          <p style="color: #666; font-size: 14px;">
            Si no esperabas esta invitación, ignorá este mensaje.
          </p>
        </div>
      </div>
    `,
  })
}

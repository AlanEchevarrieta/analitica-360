import { Webhook } from "svix";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Recibe el webhook público de Clerk, verifica la firma svix (nunca confiar
 * en el body sin verificar) y reenvía el evento ya validado a
 * apps/api POST /internal/clerk-webhook, protegido con un secreto interno
 * compartido (INTERNAL_WEBHOOK_SECRET) — ver apps/api/src/modules/usuarios.
 *
 * CLERK_WEBHOOK_SECRET se configura en dashboard.clerk.com
 * (Configure -> Webhooks -> Add Endpoint, apuntando a esta misma ruta).
 * Hasta que se configure, este endpoint responde 500 en vez de aceptar
 * eventos sin verificar.
 */
export async function POST(request: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error(
      "[webhooks/clerk] CLERK_WEBHOOK_SECRET no configurado — creá el Webhook Endpoint en dashboard.clerk.com y pegá el secreto en apps/web/.env.local",
    );
    return NextResponse.json({ error: "webhook no configurado" }, { status: 500 });
  }

  const headerList = await headers();
  const svixId = headerList.get("svix-id");
  const svixTimestamp = headerList.get("svix-timestamp");
  const svixSignature = headerList.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "faltan headers svix" }, { status: 400 });
  }

  const body = await request.text();

  let event: { type: string; data: unknown };
  try {
    const webhook = new Webhook(webhookSecret);
    event = webhook.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as unknown as { type: string; data: unknown };
  } catch (error) {
    console.error("[webhooks/clerk] firma svix inválida", error);
    return NextResponse.json({ error: "firma inválida" }, { status: 400 });
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const internalSecret = process.env.INTERNAL_WEBHOOK_SECRET;
  if (!internalSecret) {
    console.error("[webhooks/clerk] INTERNAL_WEBHOOK_SECRET no configurado en apps/web/.env.local");
    return NextResponse.json({ error: "reenvío interno no configurado" }, { status: 500 });
  }

  const forwarded = await fetch(`${apiUrl}/internal/clerk-webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-webhook-secret": internalSecret,
    },
    body: JSON.stringify(event),
  });

  if (!forwarded.ok) {
    console.error(`[webhooks/clerk] apps/api rechazó el evento: ${forwarded.status}`);
    return NextResponse.json({ error: "backend rechazó el evento" }, { status: 502 });
  }

  return NextResponse.json({ received: true });
}

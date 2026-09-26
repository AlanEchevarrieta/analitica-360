import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

// La raíz no tiene contenido propio: manda al login, a elegir empresa o al
// inicio según el estado de la sesión de Clerk.
export default async function Home() {
  const { userId, orgId } = await auth({ treatPendingAsSignedOut: false });
  if (!userId) redirect("/sign-in");
  redirect(orgId ? "/inicio" : "/elegir-empresa");
}

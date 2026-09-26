import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { ConsolaShell } from "@/features/admin/components/ConsolaShell";

/** Consola del dueño del producto: layout propio, sin el menú del comercio. */
export default async function ConsolaLayout({ children }: LayoutProps<"/">) {
  // La API identifica al usuario a través de su empresa activa.
  const { orgId } = await auth();
  if (!orgId) redirect("/elegir-empresa");
  return <ConsolaShell>{children}</ConsolaShell>;
}

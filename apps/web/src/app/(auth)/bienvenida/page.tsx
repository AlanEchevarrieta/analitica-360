import { redirect } from "next/navigation";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { BienvenidaForm } from "@/features/registro/BienvenidaForm";

// Después de crear la cuenta: datos del negocio y arranca la prueba gratis.
export default async function Page() {
  const { userId, orgId } = await auth({ treatPendingAsSignedOut: false });
  if (!userId) redirect("/sign-in");
  if (orgId) redirect("/inicio");
  // Ya pertenece a alguna empresa (ej. lo invitaron): que elija, no que cree otra.
  const { totalCount } = await (await clerkClient()).users.getOrganizationMembershipList({ userId, limit: 1 });
  if (totalCount > 0) redirect("/elegir-empresa");
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10">
      <BienvenidaForm />
    </div>
  );
}

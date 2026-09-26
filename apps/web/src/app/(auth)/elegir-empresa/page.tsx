import { redirect } from "next/navigation";
import { OrganizationList } from "@clerk/nextjs";
import { auth, clerkClient } from "@clerk/nextjs/server";

// Toda la API está scopeada a la organización activa de Clerk (EmpresaScopeGuard):
// sin una empresa elegida en la sesión, el dashboard no puede cargar datos.
export default async function Page() {
  const { userId } = await auth({ treatPendingAsSignedOut: false });
  if (!userId) redirect("/sign-in");
  // Cuenta nueva sin ninguna empresa: va directo al alta con prueba gratis.
  const { totalCount } = await (await clerkClient()).users.getOrganizationMembershipList({ userId, limit: 1 });
  if (totalCount === 0) redirect("/bienvenida");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16">
      <OrganizationList
        hidePersonal
        afterSelectOrganizationUrl="/inicio"
        appearance={{ elements: { organizationListCreateOrganizationActionButton: { display: "none" } } }}
      />
    </div>
  );
}

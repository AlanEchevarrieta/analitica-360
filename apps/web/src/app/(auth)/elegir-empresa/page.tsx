import { OrganizationList } from "@clerk/nextjs";

// Toda la API está scopeada a la organización activa de Clerk (EmpresaScopeGuard):
// sin una empresa elegida en la sesión, el dashboard no puede cargar datos.
export default function Page() {
  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <OrganizationList hidePersonal afterSelectOrganizationUrl="/inicio" afterCreateOrganizationUrl="/inicio" />
    </div>
  );
}

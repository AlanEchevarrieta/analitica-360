import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { AppSidebar } from "@/components/shared/app-sidebar";
import { AvisoCuenta } from "@/components/shared/AvisoCuenta";
import { BotonTour } from "@/components/shared/BotonTour";
import { EmpresaSwitcher } from "@/components/shared/EmpresaSwitcher";
import { GuardaDeRuta } from "@/components/shared/requiere-modulo";
import { RastreoUso } from "@/components/shared/rastreo-uso";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { CopilotFloatingWidget } from "@/features/copilot/components/copilot-floating-widget";
import { Logo } from "@/features/sitio/components/Logo";

export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  // Sin empresa activa la API responde 403 en todo: pedirla antes de entrar.
  const { orgId } = await auth();
  if (!orgId) redirect("/elegir-empresa");

  return (
    <SidebarProvider>
      <RastreoUso />
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3 sm:px-4 print:hidden max-w-full overflow-x-hidden">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4 hidden sm:block" />
          <Logo conNombre={false} className="size-6 sm:hidden ml-1" />
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5 min-w-0">
            <BotonTour />
            <EmpresaSwitcher />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-3 sm:p-4 min-w-0 max-w-full overflow-x-hidden">
          <AvisoCuenta />
          <GuardaDeRuta>{children}</GuardaDeRuta>
        </div>
      </SidebarInset>
      <CopilotFloatingWidget />
    </SidebarProvider>
  );
}

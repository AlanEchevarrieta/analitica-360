import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { AppBreadcrumbs } from "@/components/shared/AppBreadcrumbs";
import { AppSidebar } from "@/components/shared/app-sidebar";
import { AvisoCuenta } from "@/components/shared/AvisoCuenta";
import { BotonTour } from "@/components/shared/BotonTour";
import { CommandPalette } from "@/components/shared/CommandPalette";
import { EmpresaSwitcher } from "@/components/shared/EmpresaSwitcher";
import { HeaderAccionRapida } from "@/components/shared/HeaderAccionRapida";
import { MobileBottomNav } from "@/components/shared/MobileBottomNav";
import { RastreoUso } from "@/components/shared/rastreo-uso";
import { GuardaDeRuta } from "@/components/shared/requiere-modulo";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { CopilotFloatingWidget } from "@/features/copilot/components/copilot-floating-widget";

export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  // Sin sesión activa o sin empresa activa: redirigir a donde corresponde
  const { orgId, userId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/elegir-empresa");

  return (
    <SidebarProvider>
      <RastreoUso />
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur-md sm:px-4 print:hidden max-w-full overflow-x-hidden">
          <SidebarTrigger className="shrink-0" />
          <Separator orientation="vertical" className="h-4 hidden sm:block shrink-0" />
          <AppBreadcrumbs />

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            <CommandPalette />
            <HeaderAccionRapida />
            <BotonTour />
            <EmpresaSwitcher />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-3 pb-20 sm:p-4 md:pb-6 min-w-0 max-w-full overflow-x-hidden">
          <AvisoCuenta />
          <GuardaDeRuta>{children}</GuardaDeRuta>
        </div>
      </SidebarInset>
      <MobileBottomNav />
      <CopilotFloatingWidget />
    </SidebarProvider>
  );
}

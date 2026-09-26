import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { AppSidebar } from "@/components/shared/app-sidebar";
import { EmpresaSwitcher } from "@/components/shared/EmpresaSwitcher";
import { GuardaDeRuta } from "@/components/shared/requiere-modulo";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  // Sin empresa activa la API responde 403 en todo: pedirla antes de entrar.
  const { orgId } = await auth();
  if (!orgId) redirect("/elegir-empresa");

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 print:hidden">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <div className="ml-auto">
            <EmpresaSwitcher />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <GuardaDeRuta>{children}</GuardaDeRuta>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

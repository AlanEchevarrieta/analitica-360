"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOrganization, UserButton } from "@clerk/nextjs";
import {
  BarChart3,
  ClipboardList,
  Factory,
  Home,
  Package,
  Settings,
  ShoppingCart,
  Star,
  Ticket,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { useRol } from "@/hooks/use-rol";
import { tieneModulo, type ModuloClave } from "@/lib/rol";
import { useSuscripcion } from "@/hooks/use-suscripcion";
import { useTicketsNoLeidos } from "@/hooks/use-tickets-no-leidos";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  modulo: ModuloClave;
}

/**
 * Puerto fiel del menú de src/components/AppNav.tsx (legacy) - mismos ítems,
 * mismo orden, misma agrupación. El legacy usaba un top-nav en desktop y un
 * sidebar solo en tablet; acá se unifica en un sidebar persistente (patrón
 * "Operar" de impeccable) para las tres resoluciones, ya que shadcn's
 * Sidebar colapsa a Sheet en mobile por su cuenta - ningún ítem de menú se
 * perdió en el cambio de patrón visual, solo el contenedor.
 */
const NAV_PRINCIPAL: NavItem[] = [
  { href: "/ventas", label: "Ventas", icon: Wallet, modulo: "ventas" },
  { href: "/productos", label: "Productos", icon: Package, modulo: "productos" },
  { href: "/clientes", label: "Clientes", icon: Users, modulo: "clientes" },
];

const NAV_OPERACIONES: NavItem[] = [
  { href: "/compras", label: "Compras", icon: ShoppingCart, modulo: "compras" },
  { href: "/pedidos", label: "Pedidos", icon: Truck, modulo: "pedidos" },
  { href: "/proveedores", label: "Proveedores", icon: Factory, modulo: "proveedores" },
  { href: "/inventario", label: "Inventario", icon: ClipboardList, modulo: "inventario" },
];

export function AppSidebar() {
  const pathname = usePathname();
  const rol = useRol();
  const { organization } = useOrganization();
  const { data: suscripcion } = useSuscripcion();
  const { data: ticketsNoLeidos } = useTicketsNoLeidos();

  const puede = (modulo: ModuloClave) => tieneModulo(rol, modulo);
  const verConfig = tieneModulo(rol, "configuracion");
  // Soporte se gatea solo por plan en el legacy (planOk('soporte'), sin tieneModulo).
  // Sin GET /empresas/actual todavía no hay plan_actual en el frontend - fuera del
  // trial asumimos acceso; el backend (SoporteModule) sigue siendo la autorización real.
  const enTrial = suscripcion?.enTrial ?? false;
  const verSoporte = enTrial || true;

  const activo = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex flex-col gap-0.5 overflow-hidden px-2 py-1.5 group-data-[collapsible=icon]:hidden">
          <span className="text-sm font-semibold">Analítica 360</span>
          <span className="truncate text-xs text-muted-foreground">{organization?.name ?? ""}</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {puede("inicio") && (
          <SidebarGroup>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/inicio" />} isActive={pathname === "/inicio"} tooltip="Inicio">
                  <Home />
                  <span>Inicio</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}

        {NAV_PRINCIPAL.some((i) => puede(i.modulo)) && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarMenu>
                {NAV_PRINCIPAL.filter((item) => puede(item.modulo)).map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton render={<Link href={item.href} />} isActive={activo(item.href)} tooltip={item.label}>
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </>
        )}

        {NAV_OPERACIONES.some((i) => puede(i.modulo)) && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarMenu>
                {NAV_OPERACIONES.filter((item) => puede(item.modulo)).map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton render={<Link href={item.href} />} isActive={activo(item.href)} tooltip={item.label}>
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </>
        )}

        {puede("analytics") && (
          <SidebarGroup>
            <SidebarGroupLabel>Inteligencia</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/analytics" />} isActive={activo("/analytics")} tooltip="Analytics">
                  <BarChart3 />
                  <span>Analytics</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}

        {verSoporte && (
          <SidebarGroup>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/soporte" />} isActive={activo("/soporte")} tooltip="Soporte">
                  <Ticket />
                  <span>Soporte</span>
                </SidebarMenuButton>
                {Boolean(ticketsNoLeidos) && (
                  <SidebarMenuBadge>{ticketsNoLeidos! > 9 ? "9+" : ticketsNoLeidos}</SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}

        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel>Sistema</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton render={<Link href="/planes" />} isActive={activo("/planes")} tooltip="Planes">
                <Star />
                <span>Planes</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {verConfig && (
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/configuracion" />} isActive={activo("/configuracion")} tooltip="Configuración">
                  <Settings />
                  <span>Configuración</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-between gap-2 px-1 py-1">
          <UserButton />
          <ThemeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

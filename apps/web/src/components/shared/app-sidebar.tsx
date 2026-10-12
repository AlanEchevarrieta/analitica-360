"use client";

import Link from "next/link";
import { CandadoPlan } from "@/components/shared/mejorar-plan";
import { usePlan } from "@/hooks/use-plan";
import { usePathname } from "next/navigation";
import { useOrganization, UserButton } from "@clerk/nextjs";
import { SoloCliente } from "@/components/shared/solo-cliente";
import { useAcceso } from "@/hooks/use-acceso";
import {
  BarChart3,
  CalendarDays,
  Target,
  ClipboardList,
  Factory,
  FolderOpen,
  Gift,
  Hammer,
  Home,
  Package,
  Settings,
  Shield,
  ShoppingCart,
  Star,
  Ticket,
  Truck,
  Wrench,
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
} from "@/components/ui/sidebar";
import { SelectorTema } from "@/components/shared/selector-tema";
import type { ModuloClave } from "@/lib/rol";
import { useRol } from "@/hooks/use-rol";
import { useTicketsNoLeidos } from "@/hooks/use-tickets-no-leidos";
import { useEsAdmin } from "@/features/admin/hooks/use-admin";

interface Item {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Permiso del colaborador (módulo). Sin módulo: lo ve cualquiera. */
  modulo?: ModuloClave;
  /** Función del plan: si el plan no la incluye, se ve apagado con un candado. */
  funcion?: string;
  /** Condición extra (rol, administrador de la app…). */
  visible?: boolean;
  badge?: number;
}

interface Grupo {
  titulo: string;
  items: Item[];
  /** El grupo de la cuenta va pegado abajo. */
  abajo?: boolean;
}

/**
 * Menú lateral: Inicio arriba y cuatro grupos, todos con título y sin
 * separadores (antes había bloques con y sin título, y líneas en unos sí y en
 * otros no). Colapsado a íconos, los títulos se ocultan solos.
 */
export function AppSidebar() {
  const pathname = usePathname();
  const { organization } = useOrganization();
  const { data: ticketsNoLeidos } = useTicketsNoLeidos();
  // Consola del dueño del producto: solo si la API confirma que es administrador.
  const esAdmin = useEsAdmin().data?.admin === true;
  // Permisos reales del colaborador (no solo el rol): no mostrar lo que la API rechaza.
  const { puede } = useAcceso();
  const verConfig = puede("configuracion");
  const plan = usePlan();
  const rol = useRol();
  const activo = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const grupos: Grupo[] = [
    {
      titulo: "Ventas",
      items: [
        { href: "/ventas", label: "Ventas", icon: Wallet, modulo: "ventas" },
        { href: "/clientes", label: "Clientes", icon: Users, modulo: "clientes" },
        { href: "/pedidos", label: "Pedidos", icon: Truck, modulo: "pedidos" },
        { href: "/agenda", label: "Agenda", icon: CalendarDays, modulo: "ventas", funcion: "agenda" },
        { href: "/ordenes-trabajo", label: "Órdenes de trabajo", icon: Wrench, modulo: "ventas", funcion: "ordenes_trabajo" },
      ],
    },
    {
      titulo: "Stock y compras",
      items: [
        { href: "/productos", label: "Productos", icon: Package, modulo: "productos" },
        { href: "/inventario", label: "Inventario", icon: ClipboardList, modulo: "inventario" },
        { href: "/compras", label: "Compras", icon: ShoppingCart, modulo: "compras" },
        { href: "/proveedores", label: "Proveedores", icon: Factory, modulo: "proveedores" },
        { href: "/produccion", label: "Producción", icon: Hammer, modulo: "produccion" },
      ],
    },
    {
      titulo: "Gestión",
      items: [
        { href: "/analytics", label: "Analytics", icon: BarChart3, modulo: "analytics" },
        // Cada usuario ve sus propios objetivos: no depende del permiso de Analytics.
        { href: "/objetivos", label: "Objetivos", icon: Target, funcion: "objetivos" },
        // Contratos y facturas pueden ser sensibles: solo el dueño y el contador (igual que la API).
        { href: "/documentos", label: "Documentos", icon: FolderOpen, funcion: "archivo", visible: rol === "dueno" || rol === "contador" },
      ],
    },
    {
      titulo: "Cuenta",
      abajo: true,
      items: [
        { href: "/soporte", label: "Soporte", icon: Ticket, badge: ticketsNoLeidos ?? 0 },
        { href: "/planes", label: "Planes", icon: Star },
        { href: "/recomendar", label: "Recomendá y ganá", icon: Gift, visible: verConfig },
        { href: "/admin", label: "Consola", icon: Shield, visible: esAdmin },
        { href: "/configuracion", label: "Configuración", icon: Settings, visible: verConfig },
      ],
    },
  ];

  const visibles = (g: Grupo) => g.items.filter((i) => i.visible !== false && (!i.modulo || puede(i.modulo)));

  return (
    <Sidebar collapsible="icon" className="print:hidden">
      <SidebarHeader>
        <div className="flex flex-col gap-0.5 overflow-hidden px-2 py-1.5 group-data-[collapsible=icon]:hidden">
          <span className="text-sm font-semibold">Analítica 360</span>
          <span className="truncate text-xs text-muted-foreground">{organization?.name ?? ""}</span>
        </div>
      </SidebarHeader>
      <SidebarContent className="gap-0">
        {puede("inicio") && (
          <SidebarGroup className="py-1">
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

        {grupos.map((g) => {
          const items = visibles(g);
          if (items.length === 0) return null;
          return (
            <SidebarGroup key={g.titulo} className={g.abajo ? "mt-auto py-1" : "py-1"}>
              <SidebarGroupLabel>{g.titulo}</SidebarGroupLabel>
              <SidebarMenu>
                {items.map((item) => {
                  const funcion = item.funcion ?? item.modulo;
                  const bloqueado = Boolean(funcion) && !plan.incluye(funcion!);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton render={<Link href={item.href} />} isActive={activo(item.href)} tooltip={item.label} className={bloqueado ? "text-muted-foreground" : undefined}>
                        <item.icon />
                        <span>{item.label}</span>
                        {bloqueado && <CandadoPlan funcion={funcion!} />}
                      </SidebarMenuButton>
                      {Boolean(item.badge) && <SidebarMenuBadge>{item.badge! > 9 ? "9+" : item.badge}</SidebarMenuBadge>}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-between gap-2 px-1 py-1">
          <SoloCliente reserva={<span className="size-7 rounded-full bg-muted" aria-hidden />}>
            <UserButton />
          </SoloCliente>
          <SelectorTema />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

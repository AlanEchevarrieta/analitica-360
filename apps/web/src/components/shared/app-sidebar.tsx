"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth, useOrganization, UserButton } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { calcularModulosEfectivos, type ModuloToggleId } from "@analitica360/shared-types";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardList,
  CreditCard,
  Download,
  Factory,
  FolderOpen,
  Gift,
  Hammer,
  HandCoins,
  Home,
  KanbanSquare,
  Landmark,
  Package,
  Repeat,
  Settings,
  Shield,
  ShoppingCart,
  Sparkles,
  Star,
  Target,
  Ticket,
  Truck,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { CandadoPlan } from "@/components/shared/mejorar-plan";
import { SelectorTema } from "@/components/shared/selector-tema";
import { SoloCliente } from "@/components/shared/solo-cliente";
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
  useSidebar,
} from "@/components/ui/sidebar";
import { useEsAdmin } from "@/features/admin/hooks/use-admin";
import { useNuevasOnline } from "@/features/agenda/use-agenda";
import { useConfiguracion } from "@/features/configuracion/hooks/use-configuracion";
import { PasosInstalacion, type ModoPasos } from "@/features/descargar-app/PasosInstalacion";
import { Logo } from "@/features/sitio/components/Logo";
import { useAcceso } from "@/hooks/use-acceso";
import { useApiFetch } from "@/hooks/use-api";
import { useInstalarApp } from "@/hooks/use-instalar-app";
import { usePlan } from "@/hooks/use-plan";
import { useRol } from "@/hooks/use-rol";
import { useTicketsNoLeidos } from "@/hooks/use-tickets-no-leidos";
import type { ModuloClave } from "@/lib/rol";
import { ACTIVIDADES_POR_DEFECTO, type Actividad } from "@/lib/rubros";

interface Item {
  href: string;
  label: string;
  icon: LucideIcon;
  modulo?: ModuloClave;
  moduloId?: ModuloToggleId;
  funcion?: string;
  para?: Actividad[];
  visible?: boolean;
  badge?: number;
}

interface Grupo {
  titulo: string;
  items: Item[];
  abajo?: boolean;
}

const PREFETCH_RUTAS: Record<string, { key: string; url: string }> = {
  "/productos": { key: "productos", url: "/productos" },
  "/clientes": { key: "clientes", url: "/clientes" },
  "/configuracion": { key: "configuracion", url: "/configuracion" },
};

export function AppSidebar() {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const queryClient = useQueryClient();
  const api = useApiFetch();
  const { orgId } = useAuth();

  useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [pathname, isMobile, setOpenMobile]);

  const { organization } = useOrganization();
  const { data: ticketsNoLeidos } = useTicketsNoLeidos();
  const esAdmin = useEsAdmin().data?.admin === true;
  const { puede } = useAcceso();
  const verConfig = puede("configuracion");
  const plan = usePlan();
  const rol = useRol();
  const configData = useConfiguracion().data;
  const actividades = configData?.actividades ?? ACTIVIDADES_POR_DEFECTO;
  const modulosEfectivos =
    configData?.modulosEfectivos ?? calcularModulosEfectivos(actividades, configData?.modulos);

  const nuevasOnline =
    useNuevasOnline(
      actividades.includes("servicios") &&
        modulosEfectivos.agenda !== false &&
        plan.disponible("agenda"),
    ).data?.length ?? 0;
  const vendeProductos = actividades.includes("productos") || actividades.includes("produccion");
  const activo = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const { dispositivo, puedeInstalarDirecto, instalar } = useInstalarApp();
  const [modalInstalar, setModalInstalar] = useState<{ abierto: boolean; modo: ModoPasos }>({
    abierto: false,
    modo: "ios",
  });

  const tocarInstalar = async () => {
    if (dispositivo.navegador === "interno") {
      setModalInstalar({ abierto: true, modo: "interno" });
      return;
    }
    if (puedeInstalarDirecto) {
      const r = await instalar();
      if (r !== "sin_evento") return;
    }
    if (dispositivo.plataforma === "android") setModalInstalar({ abierto: true, modo: "android" });
    else if (dispositivo.plataforma === "ios") setModalInstalar({ abierto: true, modo: "ios" });
    else if (dispositivo.plataforma === "mac" && dispositivo.navegador === "safari")
      setModalInstalar({ abierto: true, modo: "mac" });
    else setModalInstalar({ abierto: true, modo: "qr" });
  };

  const precargar = (href: string) => {
    const p = PREFETCH_RUTAS[href];
    if (!p || !orgId) return;
    void queryClient.prefetchQuery({
      queryKey: [p.key, orgId],
      queryFn: () => api(p.url),
      staleTime: 60_000,
    });
  };

  const grupos: Grupo[] = [
    {
      titulo: "Ventas",
      items: [
        { href: "/ventas", label: "Ventas", icon: Wallet, modulo: "ventas" },
        { href: "/caja", label: "Caja y Turnos", icon: Landmark, modulo: "ventas", moduloId: "caja" },
        { href: "/cobros", label: "Cobros", icon: CreditCard, modulo: "ventas", moduloId: "cobros" },
        { href: "/clientes", label: "Clientes", icon: Users, modulo: "clientes", moduloId: "clientes" },
        { href: "/pedidos", label: "Pedidos", icon: Truck, modulo: "pedidos", moduloId: "pedidos", para: ["productos", "produccion"] },
        { href: "/agenda", label: "Agenda", icon: CalendarDays, modulo: "ventas", moduloId: "agenda", funcion: "agenda", para: ["servicios"], badge: nuevasOnline },
        { href: "/abonos", label: "Abonos", icon: Repeat, modulo: "ventas", moduloId: "abonos", funcion: "abonos", para: ["servicios"] },
        { href: "/ordenes-trabajo", label: "Órdenes de trabajo", icon: Wrench, modulo: "ventas", moduloId: "ordenes_trabajo", funcion: "ordenes_trabajo", para: ["servicios"] },
        { href: "/proyectos", label: "Proyectos", icon: KanbanSquare, modulo: "ventas", moduloId: "proyectos", funcion: "proyectos", para: ["servicios"] },
      ],
    },
    {
      titulo: vendeProductos ? "Stock y compras" : "Catálogo",
      items: [
        { href: "/productos", label: vendeProductos ? "Productos" : "Servicios y productos", icon: Package, modulo: "productos" },
        { href: "/inventario", label: "Inventario", icon: ClipboardList, modulo: "inventario", moduloId: "inventario", para: ["productos", "produccion"] },
        { href: "/compras", label: "Compras", icon: ShoppingCart, modulo: "compras", moduloId: "compras", para: ["productos", "produccion"] },
        { href: "/proveedores", label: "Proveedores", icon: Factory, modulo: "proveedores", moduloId: "proveedores", para: ["productos", "produccion"] },
        { href: "/produccion", label: "Producción", icon: Hammer, modulo: "produccion", moduloId: "produccion", para: ["produccion"] },
      ],
    },
    {
      titulo: "Gestión",
      items: [
        { href: "/analytics", label: "Analytics", icon: BarChart3, modulo: "analytics", moduloId: "analytics" },
        { href: "/objetivos", label: "Objetivos", icon: Target, moduloId: "objetivos", funcion: "objetivos" },
        { href: "/comisiones", label: "Comisiones", icon: HandCoins, modulo: "ventas", moduloId: "comisiones", funcion: "comisiones", para: ["servicios"] },
        { href: "/documentos", label: "Documentos", icon: FolderOpen, moduloId: "documentos", funcion: "archivo", visible: rol === "dueno" || rol === "contador" },
      ],
    },
    {
      titulo: "Cuenta",
      abajo: true,
      items: [
        { href: "/guias", label: "Guías y Manuales", icon: BookOpen },
        { href: "/soporte", label: "Soporte", icon: Ticket, badge: ticketsNoLeidos ?? 0 },
        { href: "/planes", label: "Planes", icon: Star },
        { href: "/recomendar", label: "Recomendá y ganá", icon: Gift, visible: verConfig },
        { href: "/admin", label: "Consola", icon: Shield, visible: esAdmin },
        { href: "/configuracion", label: "Configuración", icon: Settings, visible: verConfig },
      ],
    },
  ];

  const visibles = (g: Grupo) =>
    g.items.filter((i) => {
      if (i.visible === false) return false;
      if (i.modulo && !puede(i.modulo)) return false;
      if (i.moduloId) return modulosEfectivos[i.moduloId] !== false;
      return !i.para || i.para.some((a) => actividades.includes(a));
    });

  return (
    <Sidebar collapsible="icon" className="print:hidden">
      <SidebarHeader>
        <div className="flex items-center gap-2.5 overflow-hidden px-2 py-1.5">
          <Logo conNombre={false} className="size-7 shrink-0" />
          <div className="flex flex-col gap-0.5 overflow-hidden group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold tracking-tight">
              <span className="text-cyan-600 dark:text-cyan-400">Analítica</span>{" "}
              <span className="text-sky-600 dark:text-sky-400">360</span>
            </span>
            <span className="truncate text-xs text-muted-foreground">{organization?.name ?? ""}</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="gap-0">
        {puede("inicio") && (
          <SidebarGroup className="py-1">
            <SidebarMenu>
              <SidebarMenuItem id="tour-inicio">
                <SidebarMenuButton render={<Link href="/inicio" />} isActive={pathname === "/inicio"} tooltip="Inicio">
                  <Home />
                  <span>Inicio</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {modulosEfectivos.copilot !== false && (
                <SidebarMenuItem id="tour-copilot">
                  <SidebarMenuButton
                    render={<Link href="/ia" />}
                    isActive={pathname === "/ia"}
                    tooltip="Copilot IA"
                    className={!plan.incluye("copilot") ? "text-muted-foreground" : undefined}
                  >
                    <Sparkles className="text-emerald-400" />
                    <span className="flex items-center gap-1.5 font-medium">
                      <span>Copilot IA</span>
                      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400">
                        IA
                      </span>
                    </span>
                    {!plan.incluye("copilot") && <CandadoPlan funcion="copilot" />}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
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
                  const tourId = `tour-${item.href.replace(/^\//, "")}`;
                  return (
                    <SidebarMenuItem
                      key={item.href}
                      id={tourId}
                      onMouseEnter={() => precargar(item.href)}
                      onTouchStart={() => precargar(item.href)}
                    >
                      <SidebarMenuButton
                        render={<Link href={item.href} />}
                        isActive={activo(item.href)}
                        tooltip={item.label}
                        className={bloqueado ? "text-muted-foreground" : undefined}
                      >
                        <item.icon />
                        <span>{item.label}</span>
                        {bloqueado && <CandadoPlan funcion={funcion!} />}
                      </SidebarMenuButton>
                      {Boolean(item.badge) && <SidebarMenuBadge>{item.badge! > 9 ? "9+" : item.badge}</SidebarMenuBadge>}
                    </SidebarMenuItem>
                  );
                })}
                {g.abajo && !dispositivo.instalada && (
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={tocarInstalar} tooltip="Instalar la app" data-rastreo="Descargar app: menu">
                      <Download />
                      <span>Instalar la app</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
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
      <PasosInstalacion
        abierto={modalInstalar.abierto}
        onOpenChange={(abierto) => setModalInstalar((m) => ({ ...m, abierto }))}
        modo={modalInstalar.modo}
        navegador={dispositivo.navegador}
      />
    </Sidebar>
  );
}

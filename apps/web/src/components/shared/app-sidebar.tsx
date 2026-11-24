"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth, useOrganization, UserButton } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { calcularModulosEfectivos } from "@analitica360/shared-types";
import {
  BookOpen,
  ChevronDown,
  Download,
  Gift,
  Home,
  Lock,
  MoreHorizontal,
  Settings,
  Shield,
  Sparkles,
  Star,
  Ticket,
} from "lucide-react";
import { CandadoPlan } from "@/components/shared/mejorar-plan";
import { SelectorTema } from "@/components/shared/selector-tema";
import { SoloCliente } from "@/components/shared/solo-cliente";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { GRUPOS_NAVEGACION, type NavGrupo, type NavItem } from "@/lib/navegacion";
import { ACTIVIDADES_POR_DEFECTO } from "@/lib/rubros";
import { cn } from "@/lib/utils";

const PREFETCH_RUTAS: Record<string, { key: string; url: string }> = {
  "/productos": { key: "productos", url: "/productos" },
  "/clientes": { key: "clientes", url: "/clientes" },
  "/configuracion": { key: "configuracion", url: "/configuracion" },
};

const STORAGE_GRUPOS = "analitica360_sidebar_grupos";

function leerGruposGuardados(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_GRUPOS);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

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

  const [gruposAbiertos, setGruposAbiertos] = useState<Record<string, boolean>>(() => leerGruposGuardados());
  const [mostrarBloqueados, setMostrarBloqueados] = useState(false);

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

  const toggleGrupo = (id: string, estadoActual: boolean) => {
    setGruposAbiertos((prev) => {
      const siguiente = { ...prev, [id]: !estadoActual };
      try {
        localStorage.setItem(STORAGE_GRUPOS, JSON.stringify(siguiente));
      } catch {
        // Ignorar si localStorage no está disponible
      }
      return siguiente;
    });
  };

  const itemPermitido = (i: NavItem) => {
    if (i.visible === false) return false;
    if (i.href === "/documentos" && rol !== "dueno" && rol !== "contador") return false;
    if (i.modulo && !puede(i.modulo)) return false;
    if (i.moduloId) return modulosEfectivos[i.moduloId] !== false;
    return !i.para || i.para.some((a) => actividades.includes(a));
  };

  const estaBloqueado = (i: NavItem) => {
    const funcion = i.funcion ?? i.modulo;
    return Boolean(funcion) && !plan.incluye(funcion!);
  };

  const etiquetaItem = (i: NavItem) => {
    if (i.href === "/productos" && !vendeProductos) return "Servicios y productos";
    return i.label;
  };

  const badgeItem = (i: NavItem) => {
    if (i.href === "/agenda") return nuevasOnline;
    return 0;
  };

  // Separamos los módulos bloqueados por plan para evitar ruido visual de candados en la operación diaria
  const itemsBloqueados: NavItem[] = [];
  const gruposFiltrados: { grupo: NavGrupo; items: NavItem[] }[] = [];

  for (const g of GRUPOS_NAVEGACION) {
    const permitidos = g.items.filter(itemPermitido);
    const desbloqueados: NavItem[] = [];
    for (const item of permitidos) {
      if (estaBloqueado(item)) {
        itemsBloqueados.push(item);
      } else {
        desbloqueados.push(item);
      }
    }
    if (desbloqueados.length > 0) {
      gruposFiltrados.push({ grupo: g, items: desbloqueados });
    }
  }

  const copilotVisible = puede("inicio") && modulosEfectivos.copilot !== false;
  const copilotBloqueado = !plan.incluye("copilot");

  return (
    <Sidebar collapsible="icon" className="print:hidden">
      <SidebarHeader className="border-b border-sidebar-border/60">
        <div className="flex items-center gap-2.5 overflow-hidden px-2 py-1">
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

      <SidebarContent className="gap-1 py-1">
        {puede("inicio") && (
          <SidebarGroup className="py-1">
            <SidebarMenu className="gap-0.5">
              <SidebarMenuItem id="tour-inicio">
                <SidebarMenuButton
                  render={<Link href="/inicio" />}
                  isActive={pathname === "/inicio"}
                  tooltip="Inicio"
                  className={cn(pathname === "/inicio" && "font-medium")}
                >
                  <Home />
                  <span>Inicio</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {copilotVisible && !copilotBloqueado && (
                <SidebarMenuItem id="tour-copilot">
                  <SidebarMenuButton
                    render={<Link href="/ia" />}
                    isActive={activo("/ia")}
                    tooltip="Copilot IA"
                  >
                    <Sparkles className="text-emerald-500 dark:text-emerald-400" />
                    <span className="flex items-center gap-1.5 font-medium">
                      <span>Copilot IA</span>
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroup>
        )}

        {gruposFiltrados.map(({ grupo, items }) => {
          const tieneRutaActiva = items.some((i) => activo(i.href));
          const abierto = !grupo.colapsable
            ? true
            : tieneRutaActiva || (gruposAbiertos[grupo.id] ?? grupo.defaultAbierto ?? true);
          const tituloGrupo =
            grupo.id === "operativa" && !vendeProductos ? "Servicios y agenda" : grupo.titulo;

          return (
            <SidebarGroup key={grupo.id} className="py-1">
              {grupo.colapsable ? (
                <button
                  type="button"
                  onClick={() => toggleGrupo(grupo.id, abierto)}
                  aria-expanded={abierto}
                  className="flex h-7 w-full items-center justify-between rounded-md px-2 text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/65 ring-sidebar-ring outline-hidden transition-colors hover:text-sidebar-foreground focus-visible:ring-2 group-data-[collapsible=icon]:hidden cursor-pointer"
                >
                  <span className="truncate">{tituloGrupo}</span>
                  <ChevronDown
                    className={cn("size-3.5 shrink-0 transition-transform duration-150", !abierto && "-rotate-90")}
                    aria-hidden
                  />
                </button>
              ) : (
                <SidebarGroupLabel className="h-7 text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/65">
                  {tituloGrupo}
                </SidebarGroupLabel>
              )}

              {abierto && (
                <SidebarMenu className="gap-0.5">
                  {items.map((item) => {
                    const Icono = item.icon;
                    const tourId = `tour-${item.href.replace(/^\//, "")}`;
                    const label = etiquetaItem(item);
                    const badge = badgeItem(item);
                    const esActivo = activo(item.href);

                    return (
                      <SidebarMenuItem
                        key={item.href}
                        id={tourId}
                        onMouseEnter={() => precargar(item.href)}
                        onTouchStart={() => precargar(item.href)}
                      >
                        <SidebarMenuButton
                          render={<Link href={item.href} />}
                          isActive={esActivo}
                          tooltip={label}
                        >
                          <Icono />
                          <span>{label}</span>
                        </SidebarMenuButton>
                        {badge > 0 && <SidebarMenuBadge>{badge > 9 ? "9+" : badge}</SidebarMenuBadge>}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              )}
            </SidebarGroup>
          );
        })}

        {(itemsBloqueados.length > 0 || (copilotVisible && copilotBloqueado)) && (
          <SidebarGroup className="py-1 group-data-[collapsible=icon]:hidden">
            <button
              type="button"
              onClick={() => setMostrarBloqueados((v) => !v)}
              aria-expanded={mostrarBloqueados}
              className="flex h-7 w-full items-center justify-between rounded-md px-2 text-[11px] font-medium text-muted-foreground ring-sidebar-ring outline-hidden transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground focus-visible:ring-2 cursor-pointer"
            >
              <span className="flex items-center gap-1.5 truncate">
                <Lock className="size-3 shrink-0" aria-hidden />
                <span>
                  Otros planes ({itemsBloqueados.length + (copilotVisible && copilotBloqueado ? 1 : 0)})
                </span>
              </span>
              <ChevronDown
                className={cn("size-3.5 shrink-0 transition-transform duration-150", !mostrarBloqueados && "-rotate-90")}
                aria-hidden
              />
            </button>
            {mostrarBloqueados && (
              <SidebarMenu className="mt-0.5 gap-0.5">
                {copilotVisible && copilotBloqueado && (
                  <SidebarMenuItem id="tour-copilot">
                    <SidebarMenuButton
                      render={<Link href="/ia" />}
                      isActive={activo("/ia")}
                      className="text-muted-foreground"
                    >
                      <Sparkles />
                      <span>Copilot IA</span>
                      <CandadoPlan funcion="copilot" />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                {itemsBloqueados.map((item) => {
                  const Icono = item.icon;
                  const fn = item.funcion ?? item.modulo;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        render={<Link href={item.href} />}
                        isActive={activo(item.href)}
                        className="text-muted-foreground"
                      >
                        <Icono />
                        <span>{etiquetaItem(item)}</span>
                        {fn && <CandadoPlan funcion={fn} />}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            )}
          </SidebarGroup>
        )}

        {/* Utilidades compactas al pie del scroll */}
        <SidebarGroup className="mt-auto border-t border-sidebar-border/60 py-1.5">
          <SidebarMenu className="gap-0.5">
            <SidebarMenuItem id="tour-soporte">
              <SidebarMenuButton render={<Link href="/soporte" />} isActive={activo("/soporte")} tooltip="Soporte">
                <Ticket />
                <span>Soporte</span>
              </SidebarMenuButton>
              {(ticketsNoLeidos ?? 0) > 0 && (
                <SidebarMenuBadge>{ticketsNoLeidos! > 9 ? "9+" : ticketsNoLeidos}</SidebarMenuBadge>
              )}
            </SidebarMenuItem>

            {verConfig && (
              <SidebarMenuItem id="tour-configuracion">
                <SidebarMenuButton
                  render={<Link href="/configuracion" />}
                  isActive={activo("/configuracion")}
                  tooltip="Configuración"
                >
                  <Settings />
                  <span>Configuración</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}

            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <SidebarMenuButton
                      isActive={activo("/guias") || activo("/planes") || activo("/recomendar") || activo("/admin")}
                    />
                  }
                >
                  <MoreHorizontal />
                  <span>Ayuda y cuenta</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="end" className="w-52">
                  <DropdownMenuItem render={<Link href="/guias" />}>
                    <BookOpen className="size-4" aria-hidden />
                    Guías y manuales
                  </DropdownMenuItem>
                  <DropdownMenuItem render={<Link href="/planes" />}>
                    <Star className="size-4" aria-hidden />
                    Planes y suscripción
                  </DropdownMenuItem>
                  {verConfig && (
                    <DropdownMenuItem render={<Link href="/recomendar" />}>
                      <Gift className="size-4" aria-hidden />
                      Recomendá y ganá
                    </DropdownMenuItem>
                  )}
                  {esAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem render={<Link href="/admin" />}>
                        <Shield className="size-4" aria-hidden />
                        Consola Superadmin
                      </DropdownMenuItem>
                    </>
                  )}
                  {!dispositivo.instalada && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={tocarInstalar} data-rastreo="Descargar app: menu">
                        <Download className="size-4" aria-hidden />
                        Instalar la app
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/60">
        <div className="flex items-center justify-between gap-2 px-1 py-0.5">
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

"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

/**
 * Registra qué pantallas se abren y qué botones se tocan (consola → Uso).
 * Solo nombres de pantallas y de botones: nunca lo que se escribe, ni los
 * nombres que aparecen en tablas y listas (clientes, productos). Con
 * data-rastreo="Nombre" se le pone nombre a un botón; con data-rastreo-no se
 * excluye una zona.
 */
type Evento = { tipo: "vista" | "clic"; ruta: string; objetivo?: string; en: number };

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const CADA_MS = 15_000;
const CLICKEABLE = "a[href], button, [role=button], [role=tab], [role=menuitem], [role=menuitemradio], [role=switch], [data-rastreo]";
// Dentro de estas zonas el texto puede ser un dato (un cliente, un producto): se registra genérico.
const ZONA_DATOS = "table, [role=row], [role=listbox], [role=option], [cmdk-list], [data-slot=popover-content]";

function sesionId() {
  try {
    let id = sessionStorage.getItem("a360-sesion-uso");
    if (!id) sessionStorage.setItem("a360-sesion-uso", (id = crypto.randomUUID()));
    return id;
  } catch {
    return (sesionMemoria ??= crypto.randomUUID());
  }
}
let sesionMemoria: string | undefined;

export function rutaSinIds(ruta: string) {
  return ruta.split(/[?#]/)[0].replace(/\/([0-9a-f]{8}-[0-9a-f-]{27}|\d+)(?=\/|$)/gi, "/:id");
}

/** Cómo se llama lo que se tocó, sin datos de clientes. */
export function nombreDelClic(el: Element): string | null {
  const propio = el.getAttribute("data-rastreo");
  if (propio) return propio;
  if (el.closest(ZONA_DATOS)) {
    const href = el.getAttribute("href");
    return href ? `Fila → ${rutaSinIds(href)}` : "Botón en una lista";
  }
  const texto = (el.getAttribute("aria-label") || (el as HTMLElement).innerText || el.getAttribute("title") || "").replace(/\s+/g, " ").trim();
  const href = el.tagName === "A" ? el.getAttribute("href") : null;
  // Los enlaces fuera del menú pueden mostrar datos: alcanza con adónde llevan.
  if (href && !el.closest("nav, [data-sidebar]")) return `Enlace → ${rutaSinIds(href)}`;
  return texto ? texto.slice(0, 60) : href ? `Enlace → ${rutaSinIds(href)}` : null;
}

export function RastreoUso() {
  const pathname = usePathname();
  const { getToken, orgId } = useAuth();
  const cola = useRef<Evento[]>([]);
  const tokenRef = useRef(getToken);
  useEffect(() => {
    tokenRef.current = getToken;
  }, [getToken]);

  // Una vista por pantalla.
  useEffect(() => {
    cola.current.push({ tipo: "vista", ruta: rutaSinIds(pathname), en: Date.now() });
  }, [pathname]);

  useEffect(() => {
    if (!orgId || !API_URL) return;
    const enviar = async (alSalir = false) => {
      const eventos = cola.current.splice(0, 50);
      if (eventos.length === 0) return;
      try {
        const token = await tokenRef.current();
        if (!token) return;
        await fetch(`${API_URL}/uso/eventos`, {
          method: "POST",
          keepalive: alSalir,
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ sesion: sesionId(), dispositivo: window.innerWidth < 768 ? "celular" : "escritorio", eventos }),
        });
      } catch {
        // Si falla, se pierde: no vale la pena reintentar ni molestar.
      }
    };
    const alClic = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.(CLICKEABLE);
      if (!el || el.closest("[data-rastreo-no]")) return;
      const objetivo = nombreDelClic(el);
      if (objetivo) cola.current.push({ tipo: "clic", ruta: rutaSinIds(window.location.pathname), objetivo, en: Date.now() });
    };
    const alOcultar = () => {
      if (document.visibilityState === "hidden") void enviar(true);
    };
    document.addEventListener("click", alClic, { capture: true });
    document.addEventListener("visibilitychange", alOcultar);
    const intervalo = window.setInterval(() => void enviar(), CADA_MS);
    return () => {
      document.removeEventListener("click", alClic, { capture: true });
      document.removeEventListener("visibilitychange", alOcultar);
      window.clearInterval(intervalo);
      void enviar(true);
    };
  }, [orgId]);

  return null;
}

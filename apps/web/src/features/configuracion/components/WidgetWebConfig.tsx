"use client";

import { useState } from "react";
import { Check, Code2, Copy, ExternalLink, Globe, Palette, Sparkles, Calendar, ShoppingBag, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAcceso } from "@/hooks/use-acceso";
import { cn } from "@/lib/utils";

const PALETAS = [
  { nombre: "Esmeralda", color: "#059669" },
  { nombre: "Azul Océano", color: "#0284c7" },
  { nombre: "Violeta", color: "#7c3aed" },
  { nombre: "Rosa Frambuesa", color: "#db2777" },
  { nombre: "Terracota", color: "#c2410c" },
  { nombre: "Negro Carbón", color: "#18181b" },
];

export function WidgetWebConfig() {
  const { empresaId } = useAcceso();
  const [tab, setTab] = useState<"turnos" | "sdk" | "guias">("turnos");

  // Configuración del Widget de Turnos
  const [color, setColor] = useState("#059669");
  const [posicion, setPosicion] = useState<"bottom-right" | "bottom-left">("bottom-right");
  const [textoBoton, setTextoBoton] = useState("Reservar Turno");
  const [tituloModal, setTituloModal] = useState("Reserva de Turno Online");
  const [copiado, setCopiado] = useState(false);
  const [copiadoSdk, setCopiadoSdk] = useState(false);

  const scriptUrl = typeof window !== "undefined" ? `${window.location.origin}/widget.js` : "https://analitica360.app/widget.js";

  const codigoHtml = `<!-- Tipografía Cormorant Garamond -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300..700;1,300..700&display=swap" rel="stylesheet">

<!-- Widget Oficial de Reservas Online Analítica 360 -->
<script 
  src="${scriptUrl}" 
  data-empresa="${empresaId || "TU_ID_DE_EMPRESA"}"
  data-color="${color}"
  data-position="${posicion}"
  data-button-text="${textoBoton}"
  data-title="${tituloModal}">
</script>`;

  const codigoSdk = `import { Analitica360Client } from '@analitica360/sdk';

const crm = new Analitica360Client({
  empresaId: '${empresaId || "TU_ID_DE_EMPRESA"}'
});

// 1. Obtener servicios y profesionales disponibles
const opciones = await crm.turnos.opciones();

// 2. Consultar turnos libres para una fecha
const libres = await crm.turnos.libres({
  fecha: '2026-10-30',
  servicioId: 'id-servicio'
});

// 3. Confirmar la reserva del cliente
const reserva = await crm.turnos.reservar({
  servicioId: 'id-servicio',
  fecha: '2026-10-30',
  hora: '16:00',
  nombre: 'Mariana López',
  telefono: '2615551234'
});`;

  const copiarAlPortapapeles = (texto: string, esSdk = false) => {
    navigator.clipboard.writeText(texto);
    if (esSdk) {
      setCopiadoSdk(true);
      setTimeout(() => setCopiadoSdk(false), 2000);
    } else {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }
    toast.success("¡Código copiado al portapapeles!");
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div>
        <div className="flex items-center gap-2">
          <span className="text-2xl">🔌</span>
          <h2 className="text-xl font-bold tracking-tight">Integrar en mi Sitio Web</h2>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Instalá el widget de reservas online o conectá tu SPA/e-commerce existente sin cambiar de plataforma.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-2">
        <button
          type="button"
          onClick={() => setTab("turnos")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
            tab === "turnos" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Calendar className="w-4 h-4" />
          Widget de Turnos (Sin Código)
        </button>
        <button
          type="button"
          onClick={() => setTab("sdk")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
            tab === "sdk" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Code2 className="w-4 h-4" />
          SDK TypeScript (SPAs & E-commerce)
        </button>
        <button
          type="button"
          onClick={() => setTab("guias")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
            tab === "guias" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <BookOpen className="w-4 h-4" />
          Guías Paso a Paso
        </button>
      </div>

      {/* Contenido TAB 1: Widget Turnos */}
      {tab === "turnos" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Panel Izquierdo: Configuración */}
          <div className="lg:col-span-6 space-y-6 bg-card border border-border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-base flex items-center gap-2">
              <Palette className="w-4 h-4 text-primary" />
              Personalizá tu Botón de Reservas
            </h3>

            {/* Color del botón */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Color de tu marca</Label>
              <div className="flex flex-wrap items-center gap-2">
                {PALETAS.map((p) => (
                  <button
                    key={p.color}
                    type="button"
                    onClick={() => setColor(p.color)}
                    className={cn(
                      "w-7 h-7 rounded-full border-2 transition-transform",
                      color === p.color ? "border-foreground scale-110 shadow-sm" : "border-transparent hover:scale-105"
                    )}
                    style={{ backgroundColor: p.color }}
                    title={p.nombre}
                  />
                ))}
                <div className="flex items-center gap-2 ml-2">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-8 h-8 rounded border border-border cursor-pointer p-0.5 bg-background"
                  />
                  <span className="text-xs font-mono uppercase text-muted-foreground">{color}</span>
                </div>
              </div>
            </div>

            {/* Posición en la pantalla */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Ubicación del botón</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPosicion("bottom-right")}
                  className={cn(
                    "flex items-center justify-center p-3 rounded-lg border text-sm font-medium transition-all",
                    posicion === "bottom-right"
                      ? "border-primary bg-primary/10 text-primary font-semibold"
                      : "border-border hover:bg-muted/50 text-muted-foreground"
                  )}
                >
                  Abajo a la derecha
                </button>
                <button
                  type="button"
                  onClick={() => setPosicion("bottom-left")}
                  className={cn(
                    "flex items-center justify-center p-3 rounded-lg border text-sm font-medium transition-all",
                    posicion === "bottom-left"
                      ? "border-primary bg-primary/10 text-primary font-semibold"
                      : "border-border hover:bg-muted/50 text-muted-foreground"
                  )}
                >
                  Abajo a la izquierda
                </button>
              </div>
            </div>

            {/* Texto del botón */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Texto del botón</Label>
              <Input
                value={textoBoton}
                onChange={(e) => setTextoBoton(e.target.value)}
                placeholder="Ej. Reservar Turno, Agendá tu Cita"
              />
            </div>

            {/* Título de la ventana */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Título de la ventana de reservas</Label>
              <Input
                value={tituloModal}
                onChange={(e) => setTituloModal(e.target.value)}
                placeholder="Ej. Reserva de Turno Online"
              />
            </div>

            {/* Código generado */}
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Código para pegar en tu web</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copiarAlPortapapeles(codigoHtml)}
                  className="h-8 gap-1.5 text-xs"
                >
                  {copiado ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiado ? "¡Copiado!" : "Copiar código HTML"}
                </Button>
              </div>
              <pre className="p-3 bg-muted/60 border border-border rounded-lg text-xs font-mono overflow-x-auto text-foreground/90 whitespace-pre">
                {codigoHtml}
              </pre>
            </div>
          </div>

          {/* Panel Derecho: Vista Previa en Vivo */}
          <div className="lg:col-span-6 space-y-4">
            <div className="border border-border rounded-xl bg-muted/30 p-4 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                  <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                  <span className="text-xs text-muted-foreground ml-2 font-mono">tu-sitio-web.com</span>
                </div>
                <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Vista previa en vivo
                </span>
              </div>

              {/* Simulación del sitio del cliente */}
              <div className="relative bg-background border border-border rounded-lg h-72 p-6 flex flex-col justify-between overflow-hidden">
                <div className="space-y-3 opacity-60">
                  <div className="h-5 bg-muted rounded w-1/3"></div>
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>

                <div className="p-4 bg-muted/40 rounded-lg border border-border text-center max-w-sm mx-auto">
                  <p className="text-xs text-muted-foreground font-medium">Contenido de tu página web (WordPress, Wix, Webflow, etc.)</p>
                </div>

                {/* Botón flotante simulado */}
                <div
                  className={cn(
                    "absolute bottom-4 flex items-center gap-2 px-4 py-2.5 rounded-full text-white font-bold shadow-lg transition-all pointer-events-none",
                    posicion === "bottom-right" ? "right-4" : "left-4"
                  )}
                  style={{ backgroundColor: color, fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "16px", letterSpacing: "0.02em" }}
                >
                  <Calendar className="w-4 h-4" />
                  <span>{textoBoton}</span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground mt-3 text-center">
                Tus clientes verán este botón flotante. Al hacer clic, se abre el calendario con tus servicios y horarios libres.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Contenido TAB 2: SDK Developers */}
      {tab === "sdk" && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-base">SDK Oficial @analitica360/sdk</h3>
                <p className="text-sm text-muted-foreground">
                  Librería TypeScript/JavaScript isomórfica con tipos nativos, cliente HTTP desacoplado y validación de errores.
                </p>
              </div>
              <span className="px-2.5 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full">v0.1.0</span>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">1. Instalación</Label>
              <div className="p-3 bg-muted/60 border border-border rounded-lg font-mono text-xs flex justify-between items-center">
                <code>pnpm add @analitica360/sdk</code>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => {
                    navigator.clipboard.writeText("pnpm add @analitica360/sdk");
                    toast.success("¡Comando copiado!");
                  }}
                >
                  Copiar
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">2. Ejemplo de inicialización y uso</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copiarAlPortapapeles(codigoSdk, true)}
                  className="h-8 gap-1.5 text-xs"
                >
                  {copiadoSdk ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiadoSdk ? "¡Copiado!" : "Copiar código TypeScript"}
                </Button>
              </div>
              <pre className="p-4 bg-muted/60 border border-border rounded-lg text-xs font-mono overflow-x-auto text-foreground/90 whitespace-pre">
                {codigoSdk}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Contenido TAB 3: Guías de Instalación */}
      {tab === "guias" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 border border-border rounded-xl bg-card space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <span className="text-lg">🟦</span> En WordPress
            </h4>
            <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal pl-4">
              <li>Ingresá a tu panel de WordPress.</li>
              <li>Andá a <strong>Apariencia &gt; Personalizar &gt; Widgets</strong> o usá el plugin <em>Header and Footer Scripts</em>.</li>
              <li>Pegá el código del widget en el pie de página (footer) y guardá los cambios.</li>
            </ol>
          </div>

          <div className="p-5 border border-border rounded-xl bg-card space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <span className="text-lg">🟨</span> En Wix
            </h4>
            <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal pl-4">
              <li>Andá a tu panel de Wix y entrá en <strong>Ajustes &gt; Código Personalizado</strong>.</li>
              <li>Hacé clic en <strong>+ Agregar código personalizado</strong>.</li>
              <li>Pegá el código del widget y seleccionalo para cargar en <em>Body - fin</em> en todas las páginas.</li>
            </ol>
          </div>

          <div className="p-5 border border-border rounded-xl bg-card space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <span className="text-lg">🌐</span> En Webflow o Shopify
            </h4>
            <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal pl-4">
              <li>En Webflow: entrá a <strong>Project Settings &gt; Custom Code</strong> y pegalo en el campo <em>Footer Code</em>.</li>
              <li>En Shopify: andá a <strong>Tienda online &gt; Temas &gt; Editar código &gt; theme.liquid</strong> y pegalo justo antes de <code>&lt;/body&gt;</code>.</li>
            </ol>
          </div>

          <div className="p-5 border border-border rounded-xl bg-card space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <span className="text-lg">⚡</span> En SPAs / HTML Puro
            </h4>
            <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal pl-4">
              <li>Pegá la etiqueta <code>&lt;script&gt;</code> en tu archivo <code>index.html</code> antes de <code>&lt;/body&gt;</code>.</li>
              <li>O instalá <code>@analitica360/sdk</code> vía npm para control programático total de la UI.</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

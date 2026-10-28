"use client";

import { useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  DollarSign,
  ExternalLink,
  Percent,
  Plus,
  RefreshCw,
  Send,
  Settings,
  Share2,
  ShieldCheck,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatoFechaHora, formatoPesos } from "@/lib/formato";
import { cn } from "@/lib/utils";
import {
  useCrearCobro,
  useDesconectarPasarela,
  useGuardarPasarela,
  useMetricasCobros,
  usePasarelasConfig,
  useTransaccionesCobros,
  type EstadoTransaccion,
  type OrigenCobroTipo,
  type ProveedorPasarela,
} from "../hooks/use-cobros";

export function CobrosVista() {
  const [tabActiva, setTabActiva] = useState<"transacciones" | "generar" | "pasarelas" | "metricas">("transacciones");

  // Filtros de transacciones
  const [filtroProveedor, setFiltroProveedor] = useState<string>("todos");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [filtroOrigen, setFiltroOrigen] = useState<string>("todos");

  // Queries
  const { data: configData, isLoading: cargandoConfig } = usePasarelasConfig();
  const { data: txData, isLoading: cargandoTx, refetch: refetchTx } = useTransaccionesCobros({
    proveedor: filtroProveedor,
    estado: filtroEstado,
    origenTipo: filtroOrigen,
  });
  const { data: metricasData } = useMetricasCobros();

  // Mutaciones
  const guardarPasarela = useGuardarPasarela();
  const desconectarPasarela = useDesconectarPasarela();
  const crearCobro = useCrearCobro();

  // Estados del generador de cobro
  const [montoCobro, setMontoCobro] = useState<string>("");
  const [conceptoCobro, setConceptoCobro] = useState<string>("");
  const [clienteNombre, setClienteNombre] = useState<string>("");
  const [clienteEmail, setClienteEmail] = useState<string>("");
  const [proveedorCobro, setProveedorCobro] = useState<ProveedorPasarela>("mercadopago");
  const [cobroGenerado, setCobroGenerado] = useState<{ urlPago: string; monto: number; idExterno: string } | null>(null);

  // Estados de formularios de configuración
  const [mpToken, setMpToken] = useState("");
  const [mpWebhookSecret, setMpWebhookSecret] = useState("");
  const [ualaUser, setUalaUser] = useState("");
  const [ualaClientId, setUalaClientId] = useState("");
  const [ualaClientSecret, setUalaClientSecret] = useState("");
  const [stripeSecretKey, setStripeSecretKey] = useState("");
  const [stripePublishableKey, setStripePublishableKey] = useState("");

  const pasarelasConectadas = configData?.pasarelas.filter((p) => p.conectado) ?? [];

  const handleCrearCobro = async (e: React.FormEvent) => {
    e.preventDefault();
    const montoNum = parseFloat(montoCobro);
    if (!montoNum || montoNum <= 0) {
      toast.error("Ingresá un monto válido");
      return;
    }
    if (!conceptoCobro.trim()) {
      toast.error("Ingresá el concepto del cobro");
      return;
    }

    try {
      const res = await crearCobro.mutateAsync({
        monto: montoNum,
        concepto: conceptoCobro.trim(),
        proveedor: proveedorCobro,
        clienteNombre: clienteNombre.trim() || undefined,
        clienteEmail: clienteEmail.trim() || undefined,
        origenTipo: "link_rapido",
      });

      setCobroGenerado({
        urlPago: res.urlPago,
        monto: res.monto,
        idExterno: res.idExterno || res.transaccionId,
      });
      toast.success("¡Link de cobro generado con éxito!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al generar cobro");
    }
  };

  const copiarAlPortapapeles = (texto: string) => {
    void navigator.clipboard.writeText(texto);
    toast.success("Link copiado al portapapeles");
  };

  const compartirPorWhatsapp = (url: string, concepto: string, monto: number) => {
    const texto = encodeURIComponent(
      `Hola! Te comparto el link de pago para ${concepto} por ${formatoPesos(monto)}: ${url}`
    );
    window.open(`https://wa.me/?text=${texto}`, "_blank");
  };

  const badgeEstado = (estado: EstadoTransaccion) => {
    switch (estado) {
      case "aprobado":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-3" /> Aprobado
          </span>
        );
      case "pendiente":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            <Clock className="size-3" /> Pendiente
          </span>
        );
      case "rechazado":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
            <XCircle className="size-3" /> Rechazado
          </span>
        );
      case "expirado":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            Expirado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {estado}
          </span>
        );
    }
  };

  const badgeOrigen = (origen: OrigenCobroTipo) => {
    const mapas: Record<OrigenCobroTipo, string> = {
      pedido_tienda: "🛍️ Tienda Online",
      venta_pos: "💻 POS Mostrador",
      cobro_cuenta_corriente: "📋 Cuenta Corriente",
      reserva_turno: "📅 Turno / Seña",
      abono: "🔄 Abono Recurrente",
      link_rapido: "⚡ Link Rápido",
    };
    return (
      <span className="rounded-md border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
        {mapas[origen] || origen}
      </span>
    );
  };

  const badgeProveedor = (p: ProveedorPasarela) => {
    switch (p) {
      case "mercadopago":
        return <span className="font-semibold text-sky-500">Mercado Pago</span>;
      case "uala":
        return <span className="font-semibold text-rose-500">Ualá Bis</span>;
      case "stripe":
        return <span className="font-semibold text-indigo-500">Stripe</span>;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado y Métricas Rápidas */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cobros y Pasarelas de Pago</h1>
          <p className="text-sm text-muted-foreground">
            Gestión centralizada de cobros digitales, links rápidos, QR y conciliación bancaria.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setTabActiva("generar")}
            className="gap-2 bg-primary text-primary-foreground shadow-sm"
          >
            <Plus className="size-4" /> Generar Link de Cobro
          </Button>
        </div>
      </div>

      {/* Tarjetas KPI Superiores */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cobrado este Mes</CardTitle>
            <DollarSign className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metricasData ? formatoPesos(metricasData.totalBruto) : "$0"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metricasData?.aprobadas ?? 0} pagos aprobados
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Comisiones Retenidas</CardTitle>
            <Percent className="size-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metricasData ? formatoPesos(metricasData.totalComisiones) : "$0"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Costo de intermediación financiera</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Neto Acreditado</CardTitle>
            <TrendingUp className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {metricasData ? formatoPesos(metricasData.totalNeto) : "$0"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Ingreso real a tus cuentas</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pasarelas Activas</CardTitle>
            <ShieldCheck className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pasarelasConectadas.length} / 3
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {pasarelasConectadas.map((p) => p.proveedor).join(", ") || "Ninguna conectada"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Selector de Pestañas (Pill Navigation) */}
      <div className="flex border-b border-border">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTabActiva("transacciones")}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              tabActiva === "transacciones"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <CreditCard className="size-4" /> Historial de Transacciones
          </button>

          <button
            type="button"
            onClick={() => setTabActiva("generar")}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              tabActiva === "generar"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Zap className="size-4" /> Generar Link / QR Rápido
          </button>

          <button
            type="button"
            onClick={() => setTabActiva("pasarelas")}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              tabActiva === "pasarelas"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Settings className="size-4" /> Configuración de Pasarelas
          </button>

          <button
            type="button"
            onClick={() => setTabActiva("metricas")}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              tabActiva === "metricas"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Percent className="size-4" /> Comisiones & Auditoría
          </button>
        </div>
      </div>

      {/* CONTENIDO: PESTAÑA 1 - TRANSACCIONES */}
      {tabActiva === "transacciones" && (
        <div className="flex flex-col gap-4">
          {/* Barra de Filtros */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Pasarela:</span>
                <select
                  aria-label="Filtrar por pasarela"
                  value={filtroProveedor}
                  onChange={(e) => setFiltroProveedor(e.target.value)}
                  className="rounded-md border bg-background px-2.5 py-1 text-sm shadow-xs"
                >
                  <option value="todos">Todas</option>
                  <option value="mercadopago">Mercado Pago</option>
                  <option value="uala">Ualá Bis</option>
                  <option value="stripe">Stripe</option>
                </select>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Estado:</span>
                <select
                  aria-label="Filtrar por estado"
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className="rounded-md border bg-background px-2.5 py-1 text-sm shadow-xs"
                >
                  <option value="todos">Todos</option>
                  <option value="aprobado">Aprobado</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="rechazado">Rechazado</option>
                  <option value="expirado">Expirado</option>
                </select>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Canal / Origen:</span>
                <select
                  aria-label="Filtrar por canal u origen"
                  value={filtroOrigen}
                  onChange={(e) => setFiltroOrigen(e.target.value)}
                  className="rounded-md border bg-background px-2.5 py-1 text-sm shadow-xs"
                >
                  <option value="todos">Todos los canales</option>
                  <option value="pedido_tienda">Tienda Online</option>
                  <option value="venta_pos">POS / Mostrador</option>
                  <option value="cobro_cuenta_corriente">Cuenta Corriente</option>
                  <option value="reserva_turno">Turnos / Seña</option>
                  <option value="link_rapido">Link Rápido</option>
                </select>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetchTx()}
              className="gap-1.5"
            >
              <RefreshCw className="size-3.5" /> Actualizar
            </Button>
          </div>

          {/* Tabla de Cobros */}
          <div className="rounded-lg border bg-card shadow-xs overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Pasarela</th>
                  <th className="px-4 py-3">Concepto / Cliente</th>
                  <th className="px-4 py-3">Origen</th>
                  <th className="px-4 py-3 text-right">Monto Bruto</th>
                  <th className="px-4 py-3 text-right">Comisión</th>
                  <th className="px-4 py-3 text-right">Neto</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cargandoTx ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">
                      Cargando transacciones...
                    </td>
                  </tr>
                ) : !txData?.transacciones.length ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                        <CreditCard className="size-8 text-muted-foreground/60" />
                        <p className="font-medium text-foreground">No hay transacciones registradas</p>
                        <p className="text-xs text-muted-foreground">
                          Generá tu primer link de cobro o recibí pedidos en la tienda online para verlos acá en tiempo real.
                        </p>
                        <Button
                          size="sm"
                          onClick={() => setTabActiva("generar")}
                          className="mt-2"
                        >
                          Generar link de cobro
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  txData.transacciones.map((t) => (
                    <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatoFechaHora(t.createdAt)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {badgeProveedor(t.proveedor)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{t.concepto || "Cobro digital"}</div>
                        {t.clienteNombre && (
                          <div className="text-xs text-muted-foreground">{t.clienteNombre}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {badgeOrigen(t.origenTipo)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                        {formatoPesos(t.montoBruto)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-amber-600 dark:text-amber-400 whitespace-nowrap">
                        -{formatoPesos(t.comisionEstimada)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        {formatoPesos(t.montoNeto ?? t.montoBruto - t.comisionEstimada)}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {badgeEstado(t.estado)}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {t.urlPago ? (
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => copiarAlPortapapeles(t.urlPago!)}
                              title="Copiar link de pago"
                              className="size-7"
                            >
                              <Copy className="size-3.5" />
                            </Button>
                            <a
                              href={t.urlPago}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex size-7 items-center justify-center rounded-md hover:bg-muted text-muted-foreground"
                              title="Abrir checkout"
                            >
                              <ExternalLink className="size-3.5" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONTENIDO: PESTAÑA 2 - GENERAR LINK / QR RÁPIDO */}
      {tabActiva === "generar" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Formulario de Emisión */}
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-lg">Generar Cobro Instantáneo</CardTitle>
              <CardDescription>
                Creá un link de pago o código QR para compartir por WhatsApp, correo o cobrar en persona.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCrearCobro} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="monto">Monto a Cobrar ($)</Label>
                  <Input
                    id="monto"
                    type="number"
                    step="0.01"
                    placeholder="Ej. 15000"
                    value={montoCobro}
                    onChange={(e) => setMontoCobro(e.target.value)}
                    required
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="concepto">Concepto o Descripción</Label>
                  <Input
                    id="concepto"
                    placeholder="Ej. Seña mesa comedor / Saldo de cuenta corriente"
                    value={conceptoCobro}
                    onChange={(e) => setConceptoCobro(e.target.value)}
                    required
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Pasarela de Procesamiento</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setProveedorCobro("mercadopago")}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1 rounded-lg border p-3 text-xs font-medium transition-colors",
                        proveedorCobro === "mercadopago"
                          ? "border-sky-500 bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold"
                          : "border-border hover:bg-muted"
                      )}
                    >
                      <span className="text-sm">💳</span>
                      Mercado Pago
                    </button>

                    <button
                      type="button"
                      onClick={() => setProveedorCobro("uala")}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1 rounded-lg border p-3 text-xs font-medium transition-colors",
                        proveedorCobro === "uala"
                          ? "border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold"
                          : "border-border hover:bg-muted"
                      )}
                    >
                      <span className="text-sm">🚀</span>
                      Ualá Bis
                    </button>

                    <button
                      type="button"
                      onClick={() => setProveedorCobro("stripe")}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1 rounded-lg border p-3 text-xs font-medium transition-colors",
                        proveedorCobro === "stripe"
                          ? "border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold"
                          : "border-border hover:bg-muted"
                      )}
                    >
                      <span className="text-sm">🌐</span>
                      Stripe (USD/Intl)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="clienteNombre">Nombre del Cliente (opcional)</Label>
                    <Input
                      id="clienteNombre"
                      placeholder="Juan Pérez"
                      value={clienteNombre}
                      onChange={(e) => setClienteNombre(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="clienteEmail">Email del Cliente (opcional)</Label>
                    <Input
                      id="clienteEmail"
                      type="email"
                      placeholder="juan@ejemplo.com"
                      value={clienteEmail}
                      onChange={(e) => setClienteEmail(e.target.value)}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={crearCobro.isPending}
                  className="mt-2 w-full gap-2"
                >
                  {crearCobro.isPending ? "Generando link..." : "Generar Link de Cobro"}
                  <ArrowUpRight className="size-4" />
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Resultado / Compartir */}
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-lg">Link Generado</CardTitle>
              <CardDescription>
                Copia el enlace o envíaselo directamente a tu cliente por WhatsApp.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!cobroGenerado ? (
                <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed text-center text-muted-foreground p-6">
                  <Share2 className="size-10 stroke-1 text-muted-foreground/40 mb-2" />
                  <p className="text-sm font-medium">Todavía no generaste un link</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Completá el formulario a la izquierda y tocá «Generar Link de Cobro» para habilitar las opciones de compartir.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="rounded-xl border bg-emerald-500/10 p-4 border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                    <div className="flex items-center gap-2 font-semibold">
                      <CheckCircle2 className="size-5 text-emerald-500" />
                      ¡Cobro listo por {formatoPesos(cobroGenerado.monto)}!
                    </div>
                    <p className="mt-1 text-xs opacity-90">
                      Cuando tu cliente complete el pago, se marcará automáticamente como cobrado en el sistema.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label>Enlace de Pago</Label>
                    <div className="flex gap-2">
                      <Input readOnly value={cobroGenerado.urlPago} className="font-mono text-xs" />
                      <Button
                        variant="outline"
                        onClick={() => copiarAlPortapapeles(cobroGenerado.urlPago)}
                        className="gap-1.5"
                      >
                        <Copy className="size-4" /> Copiar
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pt-2">
                    <Button
                      onClick={() =>
                        compartirPorWhatsapp(
                          cobroGenerado.urlPago,
                          conceptoCobro || "tu compra",
                          cobroGenerado.monto
                        )
                      }
                      className="w-full gap-2 bg-[#25D366] text-white hover:bg-[#20ba59]"
                    >
                      <Send className="size-4" /> Enviar por WhatsApp
                    </Button>

                    <a
                      href={cobroGenerado.urlPago}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ExternalLink className="size-3.5" /> Abrir pasarela de pago para probar
                    </a>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* CONTENIDO: PESTAÑA 3 - CONFIGURACIÓN DE PASARELAS */}
      {tabActiva === "pasarelas" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Mercado Pago */}
          <Card className="border-border/60">
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-base text-sky-500 flex items-center gap-1.5">
                  <span>💳</span> Mercado Pago
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  Cobros con tarjeta, dinero en cuenta y QR interoperable.
                </CardDescription>
              </div>
              {configData?.pasarelas.find((p) => p.proveedor === "mercadopago")?.conectado ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-500">
                  <CheckCircle2 className="size-3.5" /> Activo
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Inactivo</span>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-xs">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mpToken" className="text-xs">Access Token (Producción)</Label>
                <Input
                  id="mpToken"
                  type="password"
                  placeholder="APP_USR-..."
                  value={mpToken}
                  onChange={(e) => setMpToken(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="mpWebhookSecret" className="text-xs font-medium">Firma Secreta Webhook (HMAC-SHA256)</Label>
                  <span className="text-[10px] text-muted-foreground font-mono">x-signature</span>
                </div>
                <Input
                  id="mpWebhookSecret"
                  type="password"
                  placeholder="Secret key obtenida en Developers > Webhooks"
                  value={mpWebhookSecret}
                  onChange={(e) => setMpWebhookSecret(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Validación estricta de firma HMAC contra falsificaciones y replay attacks (tolerancia de 5 min).
                </p>
              </div>

              {/* URL dinámica del webhook para configurar en Mercado Pago Developers */}
              <div className="rounded-lg border border-dashed border-border/80 p-2.5 bg-muted/30 flex flex-col gap-1.5">
                <span className="text-[11px] font-medium text-foreground">URL de Webhook Dinámico por Comercio:</span>
                <div className="flex items-center gap-1.5">
                  <code className="text-[11px] bg-background px-2 py-1 rounded border flex-1 truncate font-mono text-muted-foreground">
                    {typeof window !== "undefined"
                      ? `${window.location.origin.replace(":4001", ":3001")}/pasarelas/webhook/[tu-negocio]/mercadopago`
                      : "/pasarelas/webhook/[tu-negocio]/mercadopago"}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    type="button"
                    onClick={() => {
                      const url = `${window.location.origin.replace(":4001", ":3001")}/pasarelas/webhook/[tu-negocio]/mercadopago`;
                      navigator.clipboard.writeText(url);
                      toast.success("URL de webhook copiada");
                    }}
                  >
                    <Copy className="size-3.5" />
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Pegá esta URL en Mercado Pago Developers &gt; Webhooks. Reemplazá <code className="font-semibold text-foreground">[tu-negocio]</code> por el subdominio o nombre de tu empresa (ej: <code className="font-mono text-primary">/webhook/acacia/mercadopago</code>).
                </p>
              </div>

              <div className="rounded-lg bg-muted/50 p-2.5 text-muted-foreground">
                <p className="font-medium text-foreground">Comisión estándar:</p>
                <p>~4.4% + IVA (acreditación instantánea).</p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  className="w-full"
                  disabled={guardarPasarela.isPending || !mpToken}
                  onClick={() =>
                    guardarPasarela.mutate(
                      {
                        proveedor: "mercadopago",
                        credenciales: { accessToken: mpToken },
                        webhookSecret: mpWebhookSecret.trim() || undefined,
                      },
                      {
                        onSuccess: () => {
                          toast.success("Mercado Pago configurado correctamente con validación HMAC");
                          setMpToken("");
                          setMpWebhookSecret("");
                        },
                      }
                    )
                  }
                >
                  Guardar
                </Button>

                {configData?.pasarelas.find((p) => p.proveedor === "mercadopago")?.conectado && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    onClick={() =>
                      desconectarPasarela.mutate("mercadopago", {
                        onSuccess: () => toast.success("Mercado Pago desconectado"),
                      })
                    }
                  >
                    Desconectar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Ualá Bis */}
          <Card className="border-border/60">
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-base text-rose-500 flex items-center gap-1.5">
                  <span>🚀</span> Ualá Bis
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  Comisiones más bajas de Argentina (~3.5% + IVA) y acreditación al instante.
                </CardDescription>
              </div>
              {configData?.pasarelas.find((p) => p.proveedor === "uala")?.conectado ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-500">
                  <CheckCircle2 className="size-3.5" /> Activo
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Inactivo</span>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-xs">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ualaUser" className="text-xs">User Name (Email de tu cuenta Ualá)</Label>
                <Input
                  id="ualaUser"
                  placeholder="comercio@ejemplo.com"
                  value={ualaUser}
                  onChange={(e) => setUalaUser(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ualaClientId" className="text-xs">Client ID</Label>
                <Input
                  id="ualaClientId"
                  placeholder="Obtenido en developers.ualabis.com.ar"
                  value={ualaClientId}
                  onChange={(e) => setUalaClientId(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ualaClientSecret" className="text-xs">Client Secret</Label>
                <Input
                  id="ualaClientSecret"
                  type="password"
                  placeholder="Client secret seguro"
                  value={ualaClientSecret}
                  onChange={(e) => setUalaClientSecret(e.target.value)}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  className="w-full"
                  disabled={guardarPasarela.isPending || !ualaUser || !ualaClientId || !ualaClientSecret}
                  onClick={() =>
                    guardarPasarela.mutate(
                      {
                        proveedor: "uala",
                        credenciales: {
                          userName: ualaUser,
                          clientId: ualaClientId,
                          clientSecret: ualaClientSecret,
                        },
                      },
                      {
                        onSuccess: () => {
                          toast.success("Ualá Bis configurado correctamente");
                          setUalaUser("");
                          setUalaClientId("");
                          setUalaClientSecret("");
                        },
                      }
                    )
                  }
                >
                  Guardar
                </Button>

                {configData?.pasarelas.find((p) => p.proveedor === "uala")?.conectado && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    onClick={() =>
                      desconectarPasarela.mutate("uala", {
                        onSuccess: () => toast.success("Ualá Bis desconectado"),
                      })
                    }
                  >
                    Desconectar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Stripe */}
          <Card className="border-border/60">
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-base text-indigo-500 flex items-center gap-1.5">
                  <span>🌐</span> Stripe (Internacional)
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  Cobros internacionales con Visa, Mastercard, Amex, Apple Pay y Google Pay.
                </CardDescription>
              </div>
              {configData?.pasarelas.find((p) => p.proveedor === "stripe")?.conectado ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-500">
                  <CheckCircle2 className="size-3.5" /> Activo
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Inactivo</span>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-xs">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="stripeSecretKey" className="text-xs">Secret Key</Label>
                <Input
                  id="stripeSecretKey"
                  type="password"
                  placeholder="sk_live_..."
                  value={stripeSecretKey}
                  onChange={(e) => setStripeSecretKey(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="stripePublishableKey" className="text-xs">Publishable Key</Label>
                <Input
                  id="stripePublishableKey"
                  placeholder="pk_live_..."
                  value={stripePublishableKey}
                  onChange={(e) => setStripePublishableKey(e.target.value)}
                />
              </div>

              <div className="rounded-lg bg-muted/50 p-2.5 text-muted-foreground">
                <p className="font-medium text-foreground">Soporte Multimoneda:</p>
                <p>Permite cobrar en USD o ARS a tarjetas extranjeras.</p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  className="w-full"
                  disabled={guardarPasarela.isPending || !stripeSecretKey}
                  onClick={() =>
                    guardarPasarela.mutate(
                      {
                        proveedor: "stripe",
                        credenciales: { secretKey: stripeSecretKey },
                        publicKey: stripePublishableKey || undefined,
                      },
                      {
                        onSuccess: () => {
                          toast.success("Stripe configurado correctamente");
                          setStripeSecretKey("");
                          setStripePublishableKey("");
                        },
                      }
                    )
                  }
                >
                  Guardar
                </Button>

                {configData?.pasarelas.find((p) => p.proveedor === "stripe")?.conectado && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    onClick={() =>
                      desconectarPasarela.mutate("stripe", {
                        onSuccess: () => toast.success("Stripe desconectado"),
                      })
                    }
                  >
                    Desconectar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* CONTENIDO: PESTAÑA 4 - AUDITORÍA & COMISIONES */}
      {tabActiva === "metricas" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-lg">Desglose de Comisiones por Pasarela</CardTitle>
              <CardDescription>
                Comparativa de costos financieros retenidos por cada intermediario en el mes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                {(["mercadopago", "uala", "stripe"] as ProveedorPasarela[]).map((prov) => {
                  const m = metricasData?.porProveedor[prov] ?? { total: 0, comisiones: 0, cantidad: 0 };
                  const pct = m.total > 0 ? ((m.comisiones / m.total) * 100).toFixed(1) : "0";

                  return (
                    <div key={prov} className="rounded-lg border p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{badgeProveedor(prov)}</span>
                        <span className="text-xs text-muted-foreground">{m.cantidad} transacciones</span>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground">Volumen Bruto</p>
                          <p className="font-bold text-foreground text-sm">{formatoPesos(m.total)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Comisión Cobrada</p>
                          <p className="font-bold text-amber-600 dark:text-amber-400 text-sm">
                            {formatoPesos(m.comisiones)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Tasa Efectiva</p>
                          <p className="font-bold text-foreground text-sm">{pct}%</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="text-emerald-500">✨</span> Recomendación de Copilot IA
              </CardTitle>
              <CardDescription>
                Optimización de márgenes y canales de cobro sugeridos para tu negocio.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs leading-relaxed">
                <p className="font-semibold text-foreground text-sm mb-1">
                  💡 Priorizá Ualá Bis para cobros de mostrador
                </p>
                <p className="text-muted-foreground">
                  Ualá Bis tiene una tasa de comisión (~3.5% + IVA) inferior a Mercado Pago (~4.4% + IVA) para cobros presenciales y por link. Si derivás el 40% de tus cobros de mostrador a Ualá, podrías ahorrar aproximadamente un <strong>20% en comisiones bancarias mensuales</strong>.
                </p>
              </div>

              <div className="rounded-xl border border-border p-4 text-xs leading-relaxed">
                <p className="font-semibold text-foreground text-sm mb-1">
                  🌎 Habilitá Stripe solo para compradores internacionales
                </p>
                <p className="text-muted-foreground">
                  Stripe es ideal para transacciones transfronterizas en moneda extranjera (USD). Para compras locales en pesos argentinos, utilizá Mercado Pago o Ualá para evitar costos de conversión de divisas.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

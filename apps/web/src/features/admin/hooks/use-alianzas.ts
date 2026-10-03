"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";

// Espejos de apps/api modules/alianzas (alianzas.util.ts, alianzas-admin.service.ts, cobros.service.ts).
export type Ciclo = "mensual" | "trimestral" | "anual";
export type PlanPago = "basico" | "pro" | "ecommerce";
export type EstadoCliente = "prueba" | "sin_convertir" | "activo" | "baja";

export interface TramoComision {
  desde: number;
  hasta: number | null;
  porcentaje: number;
}

export interface ReglaCiclo {
  entrada: { meses: number; porcentaje: number }[];
  periodosEntrada: number;
  renovacionPct: number;
  renovacionPeriodos: number | null;
  /** null = las cuotas generales del plan. */
  cuotas: number | null;
}
export type ReglasCupon = Partial<Record<Ciclo, ReglaCiclo>>;

export interface CamaraFila {
  id: string;
  nombre: string;
  activa: boolean;
  codigos: { codigo: string; activo: boolean }[];
  registros: number;
  pagan: number;
  activos: number;
  conversion: number | null;
  comisionTotal: number;
}

export interface CamaraDatos {
  nombre: string;
  contactoNombre: string | null;
  contactoEmail: string | null;
  contactoTelefono: string | null;
  activa: boolean;
  mesesComision: number;
  tramos: TramoComision[];
  notas: string | null;
}

export interface Cupon {
  id: string;
  codigo: string;
  tipo: "camara" | "descuento" | "referido";
  camaraId: string | null;
  camara?: string | null;
  descripcion: string | null;
  diasPrueba: number | null;
  reglas: ReglasCupon;
  desde: string | null;
  hasta: string | null;
  maxUsos: number | null;
  usos: number;
  activo: boolean;
}
export type CuponDatos = Omit<Cupon, "id" | "usos" | "camara">;

export interface ClienteCamara {
  empresaId: string;
  empresa: string;
  plan: string;
  estado: EstadoCliente;
  orden: number | null;
  porcentaje: number | null;
  alta: string;
  pruebaHasta: string | null;
  primerPago: string | null;
  mesesConNosotros: number | null;
  mesesComisionRestantes: number | null;
  comisionHasta: string | null;
  comisionTotal: number;
  facturadoTotal: number;
  codigo: string | null;
}

export interface FichaCamara {
  camara: CamaraDatos & { id: string };
  cupones: Cupon[];
  indicadores: {
    registros: number;
    enPrueba: number;
    convertidos: number;
    conversion: number | null;
    activos: number;
    nuevosMes: number;
    bajasMes: number;
    tasaBajas: number | null;
    facturadoMes: number;
    facturadoTotal: number;
    descuentosOtorgados: number;
    comisionMes: number;
    comisionTotal: number;
    tramo: { clientesConNumero: number; porcentaje: number; faltanParaSiguiente: number | null; siguientePorcentaje: number | null };
  };
  clientes: ClienteCamara[];
}

export interface Liquidacion {
  camara: { id: string; nombre: string };
  mes: string;
  estado: "pendiente" | "aprobada" | "pagada";
  id: string | null;
  aprobadaEn: string | null;
  aprobadaPor: string | null;
  pagadaEn: string | null;
  referencia: string | null;
  total: number;
  lineas: {
    id: string;
    tipo: "pago" | "ajuste";
    empresa: string;
    orden: number | null;
    plan: string | null;
    ciclo: string | null;
    cuota: string | null;
    precioLista: number;
    cobrado: number;
    base: number;
    proporcion: number;
    porcentaje: number;
    monto: number;
    periodoDesde: string | null;
    periodoHasta: string | null;
  }[];
}

export interface ResumenAlianzas {
  porCamara: { id: string; nombre: string; registros: number; pagan: number; conversion: number | null; activos: number }[];
  comisionMes: number;
  aprobadasSinPagar: number;
  estimadoProximosMeses: { mes: string; monto: number }[];
  descuentosOtorgados: number;
}

export interface PropuestaPago {
  plan: PlanPago;
  ciclo: Ciclo;
  cotizacion: { tipo: "entrada" | "renovacion"; lista: number; total: number; descuento: number; cuotas: number; montoCuota: number; regla: string };
  cupon: { codigo: string; camara: string | null } | null;
  cuota: number | null;
  cuotas: number;
  grupoId: string | null;
  periodoDesde: string;
  periodoHasta: string;
  precioLista: number;
  monto: number;
}

export interface OrigenCliente {
  actual: { camaraId: string | null; camara: string | null; cuponId: string | null; codigo: string | null; orden: number | null; porcentaje: number | null; comisionHasta: string | null };
  historial: { id: string; antes: string; despues: string; motivo: string; hechoPor: string; createdAt: string }[];
}

export interface CuotaFila {
  id: string;
  grupoId: string;
  numero: number;
  cuotas: number;
  plan: string;
  ciclo: Ciclo;
  monto: number;
  vence: string;
  estado: "pendiente" | "pagada" | "vencida";
  diasAtraso: number;
  periodoDesde: string;
  periodoHasta: string;
  pagoId: string | null;
}
export interface PlanDeCuotas {
  grupoId: string;
  plan: string;
  ciclo: Ciclo;
  cuotas: CuotaFila[];
  pagadas: number;
  total: number;
}
export type CuotaVencida = CuotaFila & { empresaId: string; empresa: string };
export interface CuotasGeneralesPlan {
  id: string;
  plan: string;
  nombre: string;
  trimestral: number;
  anual: number;
}

function useConsulta<T>(clave: unknown[], ruta: string | null) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({ queryKey: ["admin", "alianzas", ...clave, orgId], queryFn: () => api<T>(ruta!), enabled: Boolean(orgId && ruta), retry: 1 });
}

const BASE = "/admin/alianzas";
export const useResumenAlianzas = () => useConsulta<ResumenAlianzas>(["resumen"], `${BASE}/resumen`);
export const useCamaras = () => useConsulta<CamaraFila[]>(["camaras"], `${BASE}/camaras`);
export const useFichaCamara = (id: string) => useConsulta<FichaCamara>(["camara", id], `${BASE}/camaras/${id}`);
export const useMesesCamara = (id: string) => useConsulta<{ mes: string; total: number; estado: string }[]>(["meses", id], `${BASE}/camaras/${id}/meses`);
export const useCupones = () => useConsulta<Cupon[]>(["cupones"], `${BASE}/cupones`);
export const useLiquidacion = (camaraId: string, mes: string) =>
  useConsulta<Liquidacion>(["liquidacion", camaraId, mes], mes ? `${BASE}/liquidaciones?camaraId=${camaraId}&mes=${mes}` : null);
export const useOrigenCliente = (empresaId: string) => useConsulta<OrigenCliente>(["origen", empresaId], `${BASE}/empresas/${empresaId}/origen`);

export const useCuotasGenerales = () => useConsulta<CuotasGeneralesPlan[]>(["cuotas-generales"], `${BASE}/cuotas`);
export const useCuotasVencidas = () => useConsulta<CuotaVencida[]>(["cuotas-vencidas"], "/admin/pagos/cuotas-vencidas");
export const useCuotasEmpresa = (empresaId: string) => useConsulta<PlanDeCuotas[]>(["cuotas", empresaId], empresaId ? `/admin/empresas/${empresaId}/cuotas` : null);

export function useAccionesAlianzas() {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  const refrescar = () => void queryClient.invalidateQueries({ queryKey: ["admin"] });
  const enviar = <T,>(ruta: string, body: unknown, method = "POST") => api<T>(ruta, { method, body: JSON.stringify(body) });
  return {
    crearCamara: useMutation({ mutationFn: (d: CamaraDatos) => enviar<{ id: string }>(`${BASE}/camaras`, d), onSuccess: refrescar }),
    editarCamara: useMutation({ mutationFn: ({ id, ...d }: Partial<CamaraDatos> & { id: string }) => enviar(`${BASE}/camaras/${id}`, d, "PATCH"), onSuccess: refrescar }),
    crearCupon: useMutation({ mutationFn: (d: CuponDatos) => enviar(`${BASE}/cupones`, d), onSuccess: refrescar }),
    editarCupon: useMutation({ mutationFn: ({ id, ...d }: Partial<CuponDatos> & { id: string }) => enviar(`${BASE}/cupones/${id}`, d, "PATCH"), onSuccess: refrescar }),
    aprobarLiquidacion: useMutation({ mutationFn: (d: { camaraId: string; mes: string }) => enviar(`${BASE}/liquidaciones/aprobar`, d), onSuccess: refrescar }),
    pagarLiquidacion: useMutation({ mutationFn: ({ id, ...d }: { id: string; fecha: string; referencia: string }) => enviar(`${BASE}/liquidaciones/${id}/pagar`, d), onSuccess: refrescar }),
    cambiarOrigen: useMutation({
      mutationFn: ({ empresaId, ...d }: { empresaId: string; camaraId: string | null; cuponId: string | null; motivo: string }) => enviar(`${BASE}/empresas/${empresaId}/origen`, d, "PATCH"),
      onSuccess: refrescar,
    }),
    cotizarPago: useMutation({
      mutationFn: (d: { empresaId: string; plan: PlanPago; ciclo: Ciclo; enCuotas?: boolean; grupoId?: string; desde?: string }) => enviar<PropuestaPago>("/admin/pagos/cotizar", d),
    }),
    registrarPago: useMutation({
      mutationFn: (d: { empresaId: string; plan: PlanPago; ciclo: Ciclo; metodo: string; notas: string; enCuotas?: boolean; grupoId?: string; monto?: number; desde?: string; fechaCobro?: string }) =>
        enviar<{ pago: { monto: number }; comision: { monto: number } | null }>("/admin/pagos", d),
      onSuccess: refrescar,
    }),
    editarCuotasGenerales: useMutation({
      mutationFn: ({ id, ...d }: { id: string; trimestral?: number; anual?: number }) => enviar(`${BASE}/cuotas/${id}`, d, "PATCH"),
      onSuccess: refrescar,
    }),
    devolverPago: useMutation({ mutationFn: ({ id, motivo }: { id: string; motivo: string }) => enviar(`/admin/pagos/${id}/devolver`, { motivo }), onSuccess: refrescar }),
  };
}

export const NOMBRE_CICLO: Record<Ciclo, string> = { mensual: "Mensual", trimestral: "Trimestral", anual: "Anual" };
export const NOMBRE_ESTADO_CLIENTE: Record<EstadoCliente, { texto: string; clase: string }> = {
  prueba: { texto: "En mes gratis", clase: "text-sky-400" },
  sin_convertir: { texto: "No pagó", clase: "text-muted-foreground" },
  activo: { texto: "Activo", clase: "text-emerald-400" },
  baja: { texto: "Baja", clase: "text-red-400" },
};
export const NOMBRE_TIPO_CUPON: Record<Cupon["tipo"], string> = { camara: "Cámara", descuento: "Descuento", referido: "Referido" };
export const fechaAR = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
export const pct = (n: number | null) => (n == null ? "—" : `${Math.round(n * 100)}%`);

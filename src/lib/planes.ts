import { formatoARS } from './productos'

export const PRECIOS = {
  basico: { mensual: 25000, anual: 20000 },
  pro: { mensual: 70000, anual: 56000 },
  premium: { mensual: 95000, anual: 76000 },
  ecommerce: { mensual: 150000, anual: 120000 },
} as const

export const DESCUENTO_LANZAMIENTO = 0.4
export const DESCUENTO_ANUAL = 0.2
export const MESES_DESCUENTO_LANZAMIENTO = 3

export type PlanId = 'starter' | 'basico' | 'pro' | 'premium' | 'ecommerce'
export type CicloFacturacion = 'mensual' | 'anual'
export type PlanPagoId = keyof typeof PRECIOS

export type PlanDef = {
  nombre: string
  color: string
  popular?: boolean
  modulos: readonly string[]
  max_usuarios: number | null
  max_productos: number | null
}

export const PLANES: Record<PlanId, PlanDef> = {
  starter: {
    nombre: 'Starter',
    color: '#94A3B8',
    modulos: ['inicio', 'productos', 'ventas', 'clientes'],
    max_usuarios: 1,
    max_productos: 100,
  },
  basico: {
    nombre: 'Básico',
    color: '#3B82F6',
    modulos: ['inicio', 'productos', 'ventas', 'clientes', 'compras', 'proveedores', 'inventario', 'soporte'],
    max_usuarios: 2,
    max_productos: null,
  },
  pro: {
    nombre: 'Pro',
    color: '#8B5CF6',
    modulos: [
      'inicio',
      'productos',
      'ventas',
      'clientes',
      'compras',
      'proveedores',
      'inventario',
      'soporte',
      'analytics',
      'pedidos',
    ],
    max_usuarios: 5,
    max_productos: null,
  },
  premium: {
    nombre: 'Premium',
    color: '#6366F1',
    popular: true,
    modulos: [
      'inicio',
      'productos',
      'ventas',
      'clientes',
      'compras',
      'proveedores',
      'inventario',
      'soporte',
      'analytics',
      'pedidos',
      'insights',
      'contabilidad',
    ],
    max_usuarios: null,
    max_productos: null,
  },
  ecommerce: {
    nombre: 'E-commerce',
    color: '#EC4899',
    modulos: [
      'inicio',
      'productos',
      'ventas',
      'clientes',
      'compras',
      'proveedores',
      'inventario',
      'soporte',
      'analytics',
      'pedidos',
      'insights',
      'contabilidad',
      'tienda',
    ],
    max_usuarios: null,
    max_productos: null,
  },
}

export const PLANES_PAGOS: PlanPagoId[] = ['basico', 'pro', 'premium', 'ecommerce']

export const MODULOS_COMPARATIVA: { id: string; label: string }[] = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'productos', label: 'Productos' },
  { id: 'ventas', label: 'Ventas' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'compras', label: 'Compras' },
  { id: 'proveedores', label: 'Proveedores' },
  { id: 'inventario', label: 'Inventario' },
  { id: 'soporte', label: 'Soporte' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'pedidos', label: 'Pedidos' },
  { id: 'insights', label: 'Insights' },
  { id: 'contabilidad', label: 'Contabilidad' },
  { id: 'tienda', label: 'Tienda e-commerce' },
]

export const modulosDuranteTrial = PLANES.premium.modulos

export function clavePlan(nombre: string | null | undefined): string {
  const p = (nombre ?? '').trim().toLowerCase()
  if (p === 'básico') return 'basico'
  if (p === 'business') return 'premium'
  return p
}

export function idPlan(nombre: string | null | undefined): PlanId {
  const p = clavePlan(nombre)
  if (p === 'basico' || p === 'pro' || p === 'premium' || p === 'ecommerce' || p === 'starter') return p
  return 'starter'
}

export function defPlan(plan: string | null | undefined): PlanDef {
  return PLANES[idPlan(plan)]
}

export const tieneAcceso = (plan: string, modulo: string, enTrial: boolean): boolean => {
  if (enTrial) return modulosDuranteTrial.includes(modulo)
  return defPlan(plan).modulos.includes(modulo)
}

export function planTieneAnalytics(plan: string | null | undefined, enTrial = false) {
  return tieneAcceso(clavePlan(plan), 'analytics', enTrial)
}

export function planTieneInsights(plan: string | null | undefined, enTrial = false) {
  return tieneAcceso(clavePlan(plan), 'insights', enTrial)
}

export function planMinimoParaModulo(modulo: string): PlanPagoId {
  for (const id of PLANES_PAGOS) {
    if (PLANES[id].modulos.includes(modulo)) return id
  }
  return 'premium'
}

export function etiquetaModuloPlan(modulo: string) {
  return MODULOS_COMPARATIVA.find((m) => m.id === modulo)?.label ?? modulo
}

export function precioLista(plan: PlanPagoId, ciclo: CicloFacturacion) {
  return PRECIOS[plan][ciclo]
}

export function precioLanzamiento(plan: PlanPagoId, ciclo: CicloFacturacion) {
  return Math.round(precioLista(plan, ciclo) * (1 - DESCUENTO_LANZAMIENTO))
}

export function formatoPrecioPlan(valor: number) {
  return formatoARS(valor)
}

export function desgloseAnualPlan(plan: PlanPagoId) {
  const listaMes = PRECIOS[plan].mensual
  const mes1a3 = Math.round(listaMes * (1 - DESCUENTO_LANZAMIENTO))
  const mes4a12 = Math.round(listaMes * (1 - DESCUENTO_ANUAL))
  return {
    listaMes,
    mes1a3,
    mes4a12,
    totalAnio: mes1a3 * 3 + mes4a12 * 9,
  }
}

export function mesesAhorroAnual() {
  return Math.round(DESCUENTO_ANUAL * 12)
}

export function planEsIlimitado(plan: string | null | undefined) {
  const id = idPlan(plan)
  return id === 'premium' || id === 'ecommerce'
}

export type CatalogoPlanId = 'starter' | 'basico' | 'pro' | 'premium'

export type CatalogoPlan = {
  id: CatalogoPlanId
  titulo: string
  precio: string
  destacado?: boolean
  pago: boolean
  items: string[]
}

export const CATALOGO_PLANES: CatalogoPlan[] = [
  {
    id: 'starter',
    titulo: 'Starter',
    precio: 'Gratis (14 días de prueba)',
    pago: false,
    items: ['1 usuario', 'Hasta 100 productos', 'Dashboard básico'],
  },
  {
    id: 'basico',
    titulo: 'Básico',
    precio: `${formatoPrecioPlan(precioLanzamiento('basico', 'mensual'))}/mes`,
    pago: true,
    items: ['Hasta 2 usuarios', 'Productos ilimitados', 'Compras, proveedores e inventario'],
  },
  {
    id: 'pro',
    titulo: 'Pro',
    precio: `${formatoPrecioPlan(precioLanzamiento('pro', 'mensual'))}/mes`,
    pago: true,
    items: ['Hasta 5 usuarios', 'Productos ilimitados', 'Analytics y pedidos'],
  },
  {
    id: 'premium',
    titulo: 'Premium',
    precio: `${formatoPrecioPlan(precioLanzamiento('premium', 'mensual'))}/mes`,
    pago: true,
    destacado: true,
    items: ['Usuarios ilimitados', 'Insights y contabilidad', 'Soporte prioritario'],
  },
]

export function etiquetaPlan(nombre: string | null | undefined) {
  return defPlan(nombre).nombre
}

export function linkWhatsAppPlanes(planNombre?: string) {
  const numero = (import.meta.env.VITE_WHATSAPP_CONTACT ?? '549XXXXXXXXXX').replace(/\D/g, '')
  const texto = encodeURIComponent(
    planNombre
      ? `Hola, quiero contratar el plan ${planNombre} de Analítica 360`
      : 'Hola, quiero contratar un plan de Analítica 360',
  )
  return `https://wa.me/${numero}?text=${texto}`
}

export const ORDEN_PLANES = ['starter', 'basico', 'básico', 'pro', 'premium', 'ecommerce', 'business'] as const

export function ordenarPlanesAdmin<T extends { nombre: string }>(planes: T[]) {
  return [...planes].sort((a, b) => {
    const ia = ORDEN_PLANES.indexOf(a.nombre.toLowerCase() as (typeof ORDEN_PLANES)[number])
    const ib = ORDEN_PLANES.indexOf(b.nombre.toLowerCase() as (typeof ORDEN_PLANES)[number])
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })
}

export function etiquetaEstadoSuscripcion(estado: string | null | undefined, fechaVencimiento: string | null) {
  const e = (estado ?? '').toLowerCase()
  if (fechaVencimiento) {
    const fin = new Date(`${fechaVencimiento}T00:00:00`)
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    if (fin < hoy) return 'Vencido'
  }
  if (e === 'periodo_prueba') return 'Período de prueba'
  if (e === 'activa') return 'Activo'
  if (e === 'vencida' || e === 'cancelada') return 'Vencido'
  if (e === 'pendiente_pago') return 'Pendiente de pago'
  return estado || 'Sin suscripción'
}

export function claseBadgePlan(nombre: string | null | undefined) {
  const p = clavePlan(nombre)
  if (p === 'pro') return 'bg-indigo-100 text-indigo-800 ring-1 ring-indigo-400'
  if (p === 'premium') return 'bg-amber-100 text-amber-900'
  if (p === 'ecommerce') return 'bg-pink-100 text-pink-800'
  if (p === 'basico') return 'bg-sky-100 text-sky-800'
  if (p === 'starter') return 'bg-slate-100 text-slate-700'
  return 'bg-slate-100 text-slate-700'
}

export function moduloPlanDeRuta(pathname: string): string | null {
  if (pathname.startsWith('/soporte')) return 'soporte'
  if (
    pathname.startsWith('/inicio') ||
    pathname.startsWith('/configuracion') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/planes')
  ) {
    return null
  }
  const prefijos: { prefix: string; modulo: string }[] = [
    { prefix: '/productos', modulo: 'productos' },
    { prefix: '/ventas', modulo: 'ventas' },
    { prefix: '/clientes', modulo: 'clientes' },
    { prefix: '/compras', modulo: 'compras' },
    { prefix: '/proveedores', modulo: 'proveedores' },
    { prefix: '/pedidos', modulo: 'pedidos' },
    { prefix: '/inventario', modulo: 'inventario' },
    { prefix: '/analytics', modulo: 'analytics' },
    { prefix: '/contabilidad', modulo: 'contabilidad' },
    { prefix: '/insights', modulo: 'insights' },
  ]
  const hit = prefijos.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`))
  return hit?.modulo ?? null
}

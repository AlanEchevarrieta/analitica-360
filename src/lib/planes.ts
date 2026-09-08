export function planTieneAnalytics(plan: string | null | undefined) {
  const p = (plan ?? '').trim().toLowerCase()
  return p === 'pro' || p === 'premium' || p === 'business'
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
    items: ['1 usuario', 'Hasta 50 productos', 'Dashboard básico'],
  },
  {
    id: 'basico',
    titulo: 'Básico',
    precio: '$15.000 ARS/mes',
    pago: true,
    items: ['Hasta 3 usuarios', 'Hasta 200 productos', 'Dashboard básico'],
  },
  {
    id: 'pro',
    titulo: 'Pro',
    precio: '$35.000 ARS/mes',
    pago: true,
    destacado: true,
    items: ['Hasta 10 usuarios', 'Productos ilimitados', 'Analytics avanzado ✓', 'Exportación de datos ✓'],
  },
  {
    id: 'premium',
    titulo: 'Premium',
    precio: '$70.000 ARS/mes',
    pago: true,
    items: ['Usuarios ilimitados', 'Todo lo del Pro', 'Soporte prioritario ✓', 'Reportes personalizados ✓'],
  },
]

export function etiquetaPlan(nombre: string | null | undefined) {
  const p = (nombre ?? '').trim().toLowerCase()
  if (p === 'starter') return 'Starter'
  if (p === 'basico' || p === 'básico') return 'Básico'
  if (p === 'pro') return 'Pro'
  if (p === 'premium') return 'Premium'
  if (p === 'business') return 'Business'
  return nombre || '—'
}

export function linkWhatsAppPlanes() {
  const numero = (import.meta.env.VITE_WHATSAPP_CONTACT ?? '549XXXXXXXXXX').replace(/\D/g, '')
  const texto = encodeURIComponent('Hola, quiero contratar un plan de Analítica 360')
  return `https://wa.me/${numero}?text=${texto}`
}

export const ORDEN_PLANES = ['starter', 'basico', 'básico', 'pro', 'premium', 'business'] as const

export function ordenarPlanesAdmin<T extends { nombre: string }>(planes: T[]) {
  return [...planes].sort((a, b) => {
    const ia = ORDEN_PLANES.indexOf(a.nombre.toLowerCase() as (typeof ORDEN_PLANES)[number])
    const ib = ORDEN_PLANES.indexOf(b.nombre.toLowerCase() as (typeof ORDEN_PLANES)[number])
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })
}

export function clavePlan(nombre: string | null | undefined) {
  const p = (nombre ?? '').trim().toLowerCase()
  if (p === 'básico') return 'basico'
  return p
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
  if (p === 'basico') return 'bg-sky-100 text-sky-800'
  if (p === 'starter') return 'bg-slate-100 text-slate-700'
  return 'bg-slate-100 text-slate-700'
}

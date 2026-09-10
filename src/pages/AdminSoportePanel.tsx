import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeEstadoTicket, BadgePrioridadTicket } from '../components/TicketBadges'
import { TableCard, Th, Tr, theadClass, theadStyle } from '../components/listado'
import {
  ESTADOS_TICKET,
  formatoFechaTicket,
  listarTicketsAdmin,
  type PrioridadTicket,
  type TicketFila,
} from '../lib/tickets'
import { requireSupabase } from '../lib/supabase'

export function AdminSoportePanel() {
  const [filas, setFilas] = useState<TicketFila[]>([])
  const [error, setError] = useState<string | null>(null)
  const [estado, setEstado] = useState('')
  const [prioridad, setPrioridad] = useState('')
  const [empresaId, setEmpresaId] = useState('')

  const cargar = useCallback(async () => {
    const res = await listarTicketsAdmin(requireSupabase())
    setFilas(res.filas)
    setError(res.error)
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const empresas = useMemo(() => {
    const map = new Map<string, string>()
    for (const f of filas) {
      if (f.empresa_id) map.set(f.empresa_id, f.empresa_nombre || f.empresa_id)
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es'))
  }, [filas])

  const visibles = useMemo(() => {
    return filas.filter((f) => {
      if (estado && f.estado !== estado) return false
      if (prioridad && f.prioridad !== (prioridad as PrioridadTicket)) return false
      if (empresaId && f.empresa_id !== empresaId) return false
      return true
    })
  }, [filas, estado, prioridad, empresaId])

  return (
    <div>
      {error ? <p className="mb-4 rounded-md bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p> : null}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-xs">
          Estado
          <select
            className="mt-1 block rounded-md border border-[#E2E8F0] bg-white px-2 py-1 text-sm text-[#1A2F4A]"
            value={estado}
            onChange={(ev) => setEstado(ev.target.value)}
          >
            <option value="">Todos</option>
            {ESTADOS_TICKET.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          Prioridad
          <select
            className="mt-1 block rounded-md border border-[#E2E8F0] bg-white px-2 py-1 text-sm text-[#1A2F4A]"
            value={prioridad}
            onChange={(ev) => setPrioridad(ev.target.value)}
          >
            <option value="">Todas</option>
            <option value="alta">Alta</option>
            <option value="urgente">Urgente</option>
          </select>
        </label>
        <label className="text-xs">
          Empresa
          <select
            className="mt-1 block rounded-md border border-[#E2E8F0] bg-white px-2 py-1 text-sm text-[#1A2F4A]"
            value={empresaId}
            onChange={(ev) => setEmpresaId(ev.target.value)}
          >
            <option value="">Todas</option>
            {empresas.map(([id, nombre]) => (
              <option key={id} value={id}>
                {nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      <TableCard>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead className={theadClass} style={theadStyle}>
              <tr>
                <Th>Empresa</Th>
                <Th>N°</Th>
                <Th>Asunto</Th>
                <Th>Prioridad</Th>
                <Th>Estado</Th>
                <Th>Fecha</Th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((fila, index) => (
                <Tr key={fila.id} index={index}>
                  <td className="px-3 py-3 text-sm">{fila.empresa_nombre ?? '—'}</td>
                  <td className="px-3 py-3 font-medium">
                    <Link className="text-[#A5B4FC] hover:underline" to={`/soporte/${fila.id}`}>
                      {fila.numero_ticket}
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <Link className="hover:text-[#6366F1]" to={`/soporte/${fila.id}`}>
                      {fila.asunto}
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <BadgePrioridadTicket prioridad={fila.prioridad} />
                  </td>
                  <td className="px-3 py-3">
                    <BadgeEstadoTicket estado={fila.estado} />
                  </td>
                  <td className="px-3 py-3 text-sm">{formatoFechaTicket(fila.created_at)}</td>
                </Tr>
              ))}
            </tbody>
          </table>
          {visibles.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-[#94A3B8]">No hay tickets con esos filtros.</p>
          ) : null}
        </div>
      </TableCard>
    </div>
  )
}

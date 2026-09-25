import { Injectable } from '@nestjs/common';
import { Prisma, type ConfiguracionEmpresa } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import type { ActualizarConfiguracionInput } from './configuracion.dto.js';
import type {
  ConfiguracionRecord,
  ConfiguracionRepository,
  ResultadoActualizarConfiguracion,
  TasaCuota,
} from './configuracion.repository.js';

const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Planes por defecto del legacy (se usan si la empresa nunca configuró cuotas). */
const TASAS_DEFAULT: TasaCuota[] = [
  { cuotas: 1, tasa: 0, label: '1 cuota', activo: true, personalizada: false },
  { cuotas: 3, tasa: 0, label: '3 cuotas', activo: true, personalizada: false },
  { cuotas: 6, tasa: 15, label: '6 cuotas', activo: true, personalizada: false },
  { cuotas: 12, tasa: 45, label: '12 cuotas', activo: true, personalizada: false },
];

export function aRecord(c: ConfiguracionEmpresa | null): ConfiguracionRecord {
  const inv = (c?.inventario ?? {}) as Record<string, unknown>;
  const flujo = (c?.flujoVentas ?? {}) as Record<string, unknown>;
  const tasas = Array.isArray(c?.tasasCuotas) ? (c!.tasasCuotas as unknown as TasaCuota[]) : TASAS_DEFAULT;
  const mostrar = flujo.mostrar_cliente;
  return {
    mediosPago: Array.isArray(c?.mediosPago) ? (c!.mediosPago as string[]) : ['efectivo', 'transferencia', 'debito', 'credito', 'mp_qr'],
    tasasCuotas: tasas.map((t) => ({
      cuotas: Number(t.cuotas),
      tasa: Number(t.tasa) || 0,
      label: String(t.label ?? `${t.cuotas} cuotas`),
      activo: t.activo !== false,
      personalizada: Boolean(t.personalizada),
    })),
    mostrarCliente: mostrar === 'siempre' || mostrar === 'no_mostrar' ? mostrar : 'opcional',
    crearClienteDesdeVenta: flujo.crear_desde_venta !== false,
    umbralStockBajo: Number.isFinite(Number(inv.umbral_stock_bajo)) ? Number(inv.umbral_stock_bajo) : 5,
    ubicacionVentaDefault: c?.ubicacionVentaDefault ?? texto(inv.ubicacion_venta_default),
    remitente: {
      nombre: texto(inv.remitente_nombre),
      direccion: texto(inv.remitente_direccion),
      telefono: texto(inv.remitente_telefono),
      email: texto(inv.remitente_email),
    },
    modoAsignacion: (c?.modoAsignacion as ConfiguracionRecord['modoAsignacion']) ?? 'manual',
    asignacionFijaUsuarioId: c?.asignacionFijaUsuarioId ?? null,
    asignacionRotacionIds: c?.asignacionRotacionIds ?? [],
    pais: c?.pais ?? 'argentina',
    moneda: c?.moneda ?? 'ARS',
    simboloMoneda: c?.simboloMoneda ?? '$',
    alicuotaIva: c?.alicuotaIva?.toNumber() ?? 21,
    nombreIva: c?.nombreIva ?? 'IVA',
    mostrarIvaVentas: c?.mostrarIvaVentas ?? false,
  };
}

@Injectable()
export class PrismaConfiguracionRepository implements ConfiguracionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async obtener(empresaId: string): Promise<ConfiguracionRecord> {
    return aRecord(await this.prisma.configuracionEmpresa.findUnique({ where: { empresaId } }));
  }

  async actualizar(empresaId: string, input: ActualizarConfiguracionInput): Promise<ResultadoActualizarConfiguracion> {
    return this.prisma.$transaction(async (tx) => {
      if (input.ubicacionVentaDefault) {
        const ubicacion = await tx.ubicacion.findFirst({ where: { empresaId, nombre: input.ubicacionVentaDefault } });
        if (!ubicacion) return { ok: false, motivo: 'ubicacion_invalida' };
      }
      const usuarios = [...(input.asignacionRotacionIds ?? []), ...(input.asignacionFijaUsuarioId ? [input.asignacionFijaUsuarioId] : [])];
      if (usuarios.length > 0) {
        const n = await tx.usuario.count({ where: { empresaId, id: { in: usuarios } } });
        if (n !== new Set(usuarios).size) return { ok: false, motivo: 'usuario_invalido' };
      }

      const actual = await tx.configuracionEmpresa.findUnique({ where: { empresaId } });
      const inventario = { ...((actual?.inventario ?? {}) as Record<string, unknown>) };
      if (input.umbralStockBajo !== undefined) inventario.umbral_stock_bajo = input.umbralStockBajo;
      if (input.ubicacionVentaDefault !== undefined) inventario.ubicacion_venta_default = input.ubicacionVentaDefault;
      if (input.remitente) {
        for (const [k, v] of Object.entries(input.remitente)) if (v !== undefined) inventario[`remitente_${k}`] = v || null;
      }
      const flujo = { ...((actual?.flujoVentas ?? {}) as Record<string, unknown>) };
      if (input.mostrarCliente !== undefined) flujo.mostrar_cliente = input.mostrarCliente;
      if (input.crearClienteDesdeVenta !== undefined) flujo.crear_desde_venta = input.crearClienteDesdeVenta;

      const datos = {
        ...(input.mediosPago ? { mediosPago: input.mediosPago } : {}),
        ...(input.tasasCuotas ? { tasasCuotas: [...input.tasasCuotas].sort((a, b) => a.cuotas - b.cuotas) as unknown as Prisma.InputJsonValue } : {}),
        ...(input.ubicacionVentaDefault !== undefined ? { ubicacionVentaDefault: input.ubicacionVentaDefault } : {}),
        ...(input.modoAsignacion ? { modoAsignacion: input.modoAsignacion } : {}),
        ...(input.asignacionFijaUsuarioId !== undefined ? { asignacionFijaUsuarioId: input.asignacionFijaUsuarioId } : {}),
        ...(input.asignacionRotacionIds ? { asignacionRotacionIds: input.asignacionRotacionIds } : {}),
        ...(input.pais ? { pais: input.pais } : {}),
        ...(input.moneda ? { moneda: input.moneda.toUpperCase() } : {}),
        ...(input.simboloMoneda ? { simboloMoneda: input.simboloMoneda } : {}),
        ...(input.alicuotaIva !== undefined ? { alicuotaIva: input.alicuotaIva } : {}),
        ...(input.nombreIva ? { nombreIva: input.nombreIva } : {}),
        ...(input.mostrarIvaVentas !== undefined ? { mostrarIvaVentas: input.mostrarIvaVentas } : {}),
        inventario: inventario as Prisma.InputJsonValue,
        flujoVentas: flujo as Prisma.InputJsonValue,
      };
      const guardada = await tx.configuracionEmpresa.upsert({
        where: { empresaId },
        create: { empresaId, tasasCuotas: TASAS_DEFAULT as unknown as Prisma.InputJsonValue, ...datos },
        update: datos,
      });
      return { ok: true, configuracion: aRecord(guardada) };
    });
  }
}

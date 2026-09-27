export const FORMAS_PAGO = ['efectivo', 'transferencia', 'debito', 'credito', 'qr'] as const;

/** Al vender, además: 'cuenta_corriente' = no paga ahora, queda debiendo (fiado). */
export const FORMAS_VENTA = [...FORMAS_PAGO, 'cuenta_corriente'] as const;

/** Puerto de src/lib/ventas.ts::calcularTotalesCredito. */
export function calcularTotalesCredito(totalSinInteres: number, coeficiente: number, cuotas: number) {
  const coef = Math.max(0, Number.isFinite(coeficiente) ? coeficiente : 0);
  const interes = Number((totalSinInteres * (coef / 100)).toFixed(2));
  const totalConInteres = Number((totalSinInteres + interes).toFixed(2));
  const valorCuota = cuotas > 0 ? Number((totalConInteres / cuotas).toFixed(2)) : totalConInteres;
  return { interes, totalConInteres, valorCuota };
}

/**
 * Traduce configuracion_empresa (medios_pago, tasas_cuotas) a lo que usa la
 * venta. Puerto de mediosActivos/cuotasActivas de src/lib/configuracion.ts:
 * 'mp_qr' en la configuración es 'qr' en Venta.formaPago.
 */
export function configuracionVentaDesde(
  medios: unknown,
  tasas: unknown,
  ubicacionDefault: string | null,
): { mediosPago: string[]; cuotas: { cuotas: number; tasa: number; etiqueta: string }[]; ubicacionDefault: string | null } {
  const validos = new Set<string>(FORMAS_PAGO);
  const mediosPago = Array.isArray(medios)
    ? [...new Set(medios.map((m) => (m === 'mp_qr' ? 'qr' : String(m))).filter((m) => validos.has(m)))]
    : [...FORMAS_PAGO];
  const cuotas = Array.isArray(tasas)
    ? tasas
        .filter((t): t is Record<string, unknown> => Boolean(t) && typeof t === 'object')
        .filter((t) => t.activo !== false && Number(t.cuotas) > 0)
        .map((t) => ({
          cuotas: Number(t.cuotas),
          tasa: Math.max(0, Number(t.tasa) || 0),
          etiqueta: String(t.label ?? `${Number(t.cuotas)} cuotas`),
        }))
        .sort((a, b) => a.cuotas - b.cuotas)
    : [];
  return { mediosPago: mediosPago.length > 0 ? mediosPago : [...FORMAS_PAGO], cuotas, ubicacionDefault: ubicacionDefault?.trim() || null };
}

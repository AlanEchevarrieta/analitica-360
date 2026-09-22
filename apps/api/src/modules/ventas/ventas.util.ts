export const FORMAS_PAGO = ['efectivo', 'transferencia', 'debito', 'credito', 'qr'] as const;

/** Puerto de src/lib/ventas.ts::calcularTotalesCredito. */
export function calcularTotalesCredito(totalSinInteres: number, coeficiente: number, cuotas: number) {
  const coef = Math.max(0, Number.isFinite(coeficiente) ? coeficiente : 0);
  const interes = Number((totalSinInteres * (coef / 100)).toFixed(2));
  const totalConInteres = Number((totalSinInteres + interes).toFixed(2));
  const valorCuota = cuotas > 0 ? Number((totalConInteres / cuotas).toFixed(2)) : totalConInteres;
  return { interes, totalConInteres, valorCuota };
}

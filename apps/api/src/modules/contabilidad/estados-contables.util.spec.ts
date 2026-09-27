import {
  amortizacionAcumulada,
  balanceAl,
  cajaAl,
  creditosPorVentasAl,
  estadoResultados,
  evolucionPatrimonio,
  flujoEfectivo,
  indicadores,
  mesesCompletos,
  type DatosContables,
  type MovimientoFinancieroDato,
} from './estados-contables.util.js';

const mov = (m: Partial<MovimientoFinancieroDato> & Pick<MovimientoFinancieroDato, 'tipo' | 'monto' | 'fecha'>): MovimientoFinancieroDato => ({
  vidaUtilMeses: null,
  conCaja: true,
  creado: `${m.fecha}T12:00:00Z`,
  ...m,
});

/**
 * Negocio de ejemplo: el dueño aporta 100.000, compra mercadería por 60.000
 * (40.000 contado + 20.000 a crédito), vende 50.000 que costaron 30.000, paga
 * 5.000 de alquiler, compra una notebook de 12.000 a 12 meses y toma un
 * préstamo de 10.000.
 */
function datos(): DatosContables {
  return {
    cobros: [{ fecha: '2026-01-10', monto: 50_000 }],
    resultados: [{ fecha: '2026-01-10', ingreso: 50_000, cogs: 30_000, esAjuste: false }],
    gastos: [{ fecha: '2026-01-15', monto: 5_000, categoria: 'alquiler' }],
    compras: [
      { fecha: '2026-01-05', monto: 40_000, aCredito: false },
      { fecha: '2026-01-05', monto: 20_000, aCredito: true },
    ],
    senias: [],
    movimientos: [
      mov({ tipo: 'aporte', monto: 100_000, fecha: '2026-01-01' }),
      mov({ tipo: 'bien_uso', monto: 12_000, fecha: '2026-01-02', vidaUtilMeses: 12 }),
      mov({ tipo: 'prestamo_recibido', monto: 10_000, fecha: '2026-01-03' }),
    ],
    perdidas: [],
  };
}

describe('estados contables', () => {
  it('mesesCompletos cuenta solo meses cumplidos', () => {
    expect(mesesCompletos('2026-01-15', '2026-02-14')).toBe(0);
    expect(mesesCompletos('2026-01-15', '2026-02-15')).toBe(1);
    expect(mesesCompletos('2026-01-15', '2027-03-20')).toBe(14);
    expect(mesesCompletos('2026-05-01', '2026-01-01')).toBe(0);
  });

  it('amortiza lineal y no pasa del valor del bien', () => {
    const d = datos();
    expect(amortizacionAcumulada(d.movimientos, '2026-04-02')).toBe(3_000);
    expect(amortizacionAcumulada(d.movimientos, '2030-01-01')).toBe(12_000);
  });

  it('caja: aportes + cobros + préstamo - compras contado - gastos - bien de uso', () => {
    const { saldo, estimada } = cajaAl(datos(), '2026-01-31');
    expect(saldo).toBe(100_000 - 12_000 + 10_000 - 40_000 + 50_000 - 5_000);
    expect(estimada).toBe(true);
  });

  it('un arqueo fija el saldo y cuenta solo lo posterior', () => {
    const d = datos();
    d.movimientos.push(mov({ tipo: 'arqueo', monto: 90_000, fecha: '2026-01-12' }));
    expect(cajaAl(d, '2026-01-12').saldo).toBe(90_000);
    expect(cajaAl(d, '2026-01-31')).toEqual({ saldo: 85_000, estimada: false });
  });

  it('el balance cuadra: activo = pasivo + patrimonio neto', () => {
    // Stock a costo: 60.000 comprados - 30.000 vendidos.
    const b = balanceAl(datos(), '2026-01-31', 30_000);
    expect(b.activo.caja).toBe(103_000);
    expect(b.activo.bienesDeUso).toBe(12_000);
    expect(b.pasivo).toEqual({ deudasComerciales: 20_000, prestamos: 10_000, total: 30_000 });
    expect(b.activo.total).toBe(b.pasivo.total + b.patrimonioNeto.total);
    // Sin ajustes de stock, el patrimonio se explica entero por aportes y resultados.
    expect(b.patrimonioNeto.resultadosAcumulados).toBe(15_000);
    expect(b.patrimonioNeto.capitalInicialYAjustes).toBe(0);
  });

  it('estado de resultados con amortización del período', () => {
    const r = estadoResultados(datos(), '2026-01-01', '2026-03-31', 1);
    expect(r.ventasNetas).toBe(50_000);
    expect(r.resultadoBruto).toBe(20_000);
    expect(r.amortizaciones).toBe(2_000); // 02/01 -> 31/03: 2 meses cumplidos
    expect(r.resultadoNeto).toBe(13_000);
    expect(r.gastosPorCategoria).toEqual([{ categoria: 'alquiler', monto: 5_000 }]);
  });

  it('devoluciones restan de ventas y reintegran plata', () => {
    const d = datos();
    d.resultados.push({ fecha: '2026-01-20', ingreso: -5_000, cogs: -3_000, esAjuste: true });
    const r = estadoResultados(d, '2026-01-01', '2026-01-31', 1);
    expect(r.devoluciones).toBe(-5_000);
    expect(r.ventasNetas).toBe(45_000);
    const f = flujoEfectivo(d, '2026-01-01', '2026-01-31');
    expect(f.lineas.find((l) => l.concepto === 'devoluciones')?.monto).toBe(-5_000);
  });

  it('flujo de efectivo cuadra saldo inicial + flujos = saldo final', () => {
    const f = flujoEfectivo(datos(), '2026-01-01', '2026-01-31');
    expect(f.saldoInicial).toBe(0);
    expect(f.operativas).toBe(50_000 - 40_000 - 5_000);
    expect(f.inversion).toBe(-12_000);
    expect(f.financiacion).toBe(110_000);
    expect(f.diferenciasArqueo).toBe(0);
    expect(f.saldoFinal).toBe(103_000);
  });

  it('el pago al proveedor baja la deuda y la caja, no el resultado', () => {
    const d = datos();
    d.movimientos.push(mov({ tipo: 'pago_proveedor', monto: 15_000, fecha: '2026-01-25' }));
    const b = balanceAl(d, '2026-01-31', 30_000);
    expect(b.pasivo.deudasComerciales).toBe(5_000);
    expect(b.activo.caja).toBe(88_000);
    expect(b.patrimonioNeto.total).toBe(balanceAl(datos(), '2026-01-31', 30_000).patrimonioNeto.total);
  });

  it('seña: lo que falta cobrar es crédito hasta el día que se cobra', () => {
    // Seña cobrada en dos pagos registrados: cada uno baja la deuda el día que se pagó.
    const enPartes = [{ fecha: '2026-03-01', total: 10_000, montoSenia: 0, saldoPendiente: 3_000, fechaCobroSaldo: null, cobros: [{ fecha: '2026-03-05', monto: 4_000 }, { fecha: '2026-03-20', monto: 3_000 }] }];
    expect(creditosPorVentasAl(enPartes, '2026-03-02')).toBe(10_000);
    expect(creditosPorVentasAl(enPartes, '2026-03-10')).toBe(6_000);
    expect(creditosPorVentasAl(enPartes, '2026-03-31')).toBe(3_000);
    const senias = [{ fecha: '2026-01-10', total: 10_000, montoSenia: 3_000, saldoPendiente: 0, fechaCobroSaldo: '2026-02-05' }];
    expect(creditosPorVentasAl(senias, '2026-01-31')).toBe(7_000);
    expect(creditosPorVentasAl(senias, '2026-02-05')).toBe(0);
    expect(creditosPorVentasAl(senias, '2026-01-09')).toBe(0);
  });

  it('una rotura es pérdida del período y no queda como ajuste del patrimonio', () => {
    const d = datos();
    // Se rompe mercadería que costaba 2.000: el stock a costo baja de 30.000 a 28.000.
    d.perdidas.push({ fecha: '2026-01-20', monto: 2_000 });
    const r = estadoResultados(d, '2026-01-01', '2026-01-31', 1);
    expect(r.perdidasMercaderia).toBe(2_000);
    const sin = estadoResultados(datos(), '2026-01-01', '2026-01-31', 1);
    expect(r.resultadoNeto).toBe(sin.resultadoNeto - 2_000);
    const b = balanceAl(d, '2026-01-31', 28_000);
    expect(b.activo.total).toBe(b.pasivo.total + b.patrimonioNeto.total);
    expect(b.patrimonioNeto.capitalInicialYAjustes).toBe(0);
  });

  it('evolución del patrimonio: inicio + aportes - retiros + resultado + ajustes = cierre', () => {
    const d = datos();
    d.movimientos.push(mov({ tipo: 'retiro', monto: 4_000, fecha: '2026-01-28' }));
    const inicio = balanceAl(d, '2025-12-31', 0);
    const cierre = balanceAl(d, '2026-01-31', 30_000);
    const r = estadoResultados(d, '2026-01-01', '2026-01-31', 1);
    const e = evolucionPatrimonio(d, '2026-01-01', '2026-01-31', inicio, cierre, r.resultadoNeto);
    expect(e.aportes).toBe(100_000);
    expect(e.retiros).toBe(4_000);
    expect(e.inicio + e.aportes - e.retiros + e.resultado + e.ajustes).toBeCloseTo(e.cierre, 2);
    expect(e.ajustes).toBe(0);
  });

  it('bien aportado en especie: suma al patrimonio sin salir de la caja', () => {
    const d = datos();
    d.movimientos.push(mov({ tipo: 'bien_uso', monto: 8_000, fecha: '2026-01-02', vidaUtilMeses: null, conCaja: false }));
    const b = balanceAl(d, '2026-01-31', 30_000);
    expect(b.activo.caja).toBe(103_000);
    expect(b.patrimonioNeto.aportes).toBe(108_000);
    expect(b.patrimonioNeto.capitalInicialYAjustes).toBe(0);
  });

  it('indicadores', () => {
    const inicio = balanceAl(datos(), '2025-12-31', 0);
    const cierre = balanceAl(datos(), '2026-01-31', 30_000);
    const i = indicadores(inicio, cierre, 15_000);
    expect(i.liquidez).toBe(4.43); // (103.000 + 30.000) / 30.000
    expect(i.pruebaAcida).toBe(3.43);
    expect(i.endeudamiento).toBe(0.26);
    // Patrimonio promedio (0 + 115.000) / 2
    expect(i.rentabilidadPatrimonioPct).toBe(26.1);
  });
});

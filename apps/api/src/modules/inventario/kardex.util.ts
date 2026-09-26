import { costoPromedioPonderado } from './costo-promedio.js';

/**
 * Kardex valorizado por costo promedio ponderado (PPP): cada entrada con
 * costo conocido recalcula el promedio; cada salida se valúa al promedio
 * vigente en ese momento. Los traslados entre ubicaciones no cambian el
 * stock total del producto, así que no entran.
 */

/** Salidas que son una pérdida para el negocio (van como gasto en el estado de resultados). */
export const TIPOS_PERDIDA = ['merma', 'rotura', 'perdida', 'consumo_interno'] as const;

export interface MovimientoKardex {
  id: string;
  /** YYYY-MM-DD (día en Argentina). */
  fecha: string;
  fechaHora: Date;
  tipo: string;
  cantidad: number;
  signo: 1 | -1;
  costoUnitario: number | null;
  varianteId: string | null;
  motivo: string | null;
  referenciaId: string | null;
  usuario: string | null;
}

export interface FilaKardex {
  id: string;
  fecha: Date;
  tipo: string;
  varianteId: string | null;
  motivo: string | null;
  referenciaId: string | null;
  usuario: string | null;
  entrada: number;
  salida: number;
  /** Costo unitario con el que se valuó el movimiento. */
  costoUnitario: number;
  /** Positivo si entra, negativo si sale. */
  valor: number;
  saldoCantidad: number;
  costoPromedio: number;
  saldoValor: number;
  /** Cambio de valor de unidades vendidas sin stock (ver KardexValorizado.diferenciaValuacion). */
  diferenciaValuacion: number;
}

export interface TotalKardex {
  cantidad: number;
  valor: number;
}

export interface KardexValorizado {
  inicial: TotalKardex & { costoPromedio: number };
  entradas: TotalKardex;
  salidas: TotalKardex;
  /**
   * Mermas, roturas, pérdidas y consumo interno del período (salidas que son gasto),
   * al costo con que se registraron: el mismo que resta el estado de resultados.
   */
  perdidas: TotalKardex;
  /**
   * Revaluación de unidades vendidas sin stock: cuando el saldo es negativo y
   * entra mercadería a otro costo, esas unidades cambian de valor. Con esto
   * inicial + entradas - salidas + diferencia = final siempre cierra.
   */
  diferenciaValuacion: number;
  /** Hubo momentos del período con stock negativo (ventas antes de cargar la compra). */
  stockNegativo: boolean;
  final: TotalKardex & { costoPromedio: number };
  filas: FilaKardex[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * @param movimientos todos los movimientos del producto (cualquier orden), hasta `hasta` inclusive.
 * @param costoRespaldo costo a usar si todavía no hubo ninguna entrada con costo (ej. el costo cargado en el producto).
 */
export function kardexValorizado(movimientos: MovimientoKardex[], desde: string, hasta: string, costoRespaldo: number | null): KardexValorizado {
  const orden = [...movimientos]
    .filter((m) => m.tipo !== 'transferencia' && m.fecha <= hasta)
    .sort((a, b) => a.fechaHora.getTime() - b.fechaHora.getTime() || a.id.localeCompare(b.id));

  let cantidad = 0;
  let promedio: number | null = null;
  let inicial: KardexValorizado['inicial'] | null = null;
  const entradas = { cantidad: 0, valor: 0 };
  const salidas = { cantidad: 0, valor: 0 };
  const perdidas = { cantidad: 0, valor: 0 };
  let diferencia = 0;
  let negativo = false;
  const filas: FilaKardex[] = [];
  const foto = () => ({ cantidad: r2(cantidad), costoPromedio: r2(promedio ?? costoRespaldo ?? 0), valor: r2(cantidad * (promedio ?? costoRespaldo ?? 0)) });

  for (const m of orden) {
    if (!inicial && m.fecha >= desde) inicial = foto();
    const valorAntes = foto().valor;
    let costo: number;
    if (m.signo > 0) {
      costo = m.costoUnitario && m.costoUnitario > 0 ? m.costoUnitario : (promedio ?? costoRespaldo ?? 0);
      if (costo > 0) promedio = costoPromedioPonderado(cantidad, promedio, m.cantidad, costo);
    } else {
      costo = promedio ?? (m.costoUnitario && m.costoUnitario > 0 ? m.costoUnitario : (costoRespaldo ?? 0));
    }
    cantidad += m.cantidad * m.signo;
    if (m.fecha < desde) continue;

    const valor = r2(m.cantidad * costo * m.signo);
    if (m.signo > 0) {
      entradas.cantidad += m.cantidad;
      entradas.valor += valor;
    } else {
      salidas.cantidad += m.cantidad;
      salidas.valor -= valor;
      if ((TIPOS_PERDIDA as readonly string[]).includes(m.tipo)) {
        perdidas.cantidad += m.cantidad;
        perdidas.valor += m.cantidad * (m.costoUnitario && m.costoUnitario > 0 ? m.costoUnitario : costo);
      }
    }
    const saldo = foto();
    const dif = r2(saldo.valor - valorAntes - valor);
    diferencia += dif;
    if (saldo.cantidad < 0) negativo = true;
    filas.push({
      id: m.id,
      fecha: m.fechaHora,
      tipo: m.tipo,
      varianteId: m.varianteId,
      motivo: m.motivo,
      referenciaId: m.referenciaId,
      usuario: m.usuario,
      entrada: m.signo > 0 ? m.cantidad : 0,
      salida: m.signo < 0 ? m.cantidad : 0,
      costoUnitario: r2(costo),
      valor,
      saldoCantidad: saldo.cantidad,
      costoPromedio: saldo.costoPromedio,
      saldoValor: saldo.valor,
      diferenciaValuacion: dif,
    });
  }
  const redondeado = (t: TotalKardex) => ({ cantidad: r2(t.cantidad), valor: r2(t.valor) });
  return {
    inicial: inicial ?? foto(),
    entradas: redondeado(entradas),
    salidas: redondeado(salidas),
    perdidas: redondeado(perdidas),
    diferenciaValuacion: r2(diferencia),
    stockNegativo: negativo || (inicial ?? foto()).cantidad < 0,
    final: foto(),
    filas,
  };
}

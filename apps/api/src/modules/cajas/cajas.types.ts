export interface DesgloseMedioPago {
  medio: string;
  etiqueta: string;
  cantidad: number;
  total: number;
}

export interface MovimientoResumen {
  id: string;
  tipo: 'ingreso' | 'egreso';
  monto: number;
  concepto: string;
  comprobanteRef?: string | null;
  fecha: string;
  usuarioNombre: string;
}

export interface ResumenReporteXZ {
  tipoReporte: 'X' | 'Z';
  cajaId: string;
  nombreCaja: string;
  estado: 'abierta' | 'cerrada';
  fechaApertura: string;
  fechaCierre: string | null;
  cajeroApertura: {
    id: string;
    nombre: string;
  };
  cajeroCierre: {
    id: string;
    nombre: string;
  } | null;
  ubicacionNombre: string | null;
  negocio: {
    nombre: string;
    cuit: string | null;
    direccion: string | null;
    telefono: string | null;
  };
  montoInicial: number;
  ventasPorMedioPago: DesgloseMedioPago[];
  totalVentas: number;
  totalVentasEfectivo: number;
  totalVentasDigital: number;
  cantidadVentas: number;
  movimientos: MovimientoResumen[];
  totalIngresos: number;
  totalEgresos: number;
  efectivoEsperado: number;
  montoDeclarado: number | null;
  diferencia: number | null;
  notasApertura: string | null;
  notasCierre: string | null;
}

export interface EstadoCajaActiva {
  caja: {
    id: string;
    nombreCaja: string;
    estado: 'abierta' | 'cerrada';
    montoInicial: number;
    fechaApertura: string;
    usuarioApertura: {
      id: string;
      nombre: string;
    };
    ubicacionId: string | null;
    notasApertura: string | null;
  } | null;
  totalesEnVivo: {
    ventasEfectivo: number;
    ventasDigitales: number;
    cantidadVentas: number;
    totalIngresos: number;
    totalEgresos: number;
    efectivoEnCajaEsperado: number;
  } | null;
  movimientosRecientes: MovimientoResumen[];
}

export type EstadoProyecto = 'activo' | 'pausado' | 'terminado' | 'cancelado';
export type EstadoEtapa = 'pendiente' | 'en_curso' | 'en_revision' | 'aprobada' | 'omitida';
export type TipoAprobacion = 'ninguna' | 'interna' | 'cliente' | 'ambas';
export type FaltaAprobacion = 'interna' | 'cliente' | null;
export type AccionEtapa = 'empezar' | 'enviar_revision' | 'terminar' | 'aprobar' | 'pedir_cambios' | 'omitir';

export interface EtapaParaTransicion {
  id: string;
  orden: number;
  nombre: string;
  estado: EstadoEtapa;
  aprobacion: TipoAprobacion;
  falta: FaltaAprobacion;
  version: number;
  iniciadaEn: Date | null;
  enRevisionDesde: Date | null;
  cerradaEn: Date | null;
  minutosTrabajo: number;
  minutosEspera: number;
  rondasCambios: number;
  responsableId?: string | null;
  aprobadorInternoId?: string | null;
}

export interface DatosTransicionEtapa {
  ahora?: Date;
  esEtapaActual?: boolean;
  tipoAprobador?: 'interna' | 'cliente';
  versionAprobada?: number;
  nota?: string | null;
  comentario?: string | null;
}

export interface CambiosEtapa {
  estado: EstadoEtapa;
  falta: FaltaAprobacion;
  version: number;
  iniciadaEn: Date | null;
  enRevisionDesde: Date | null;
  cerradaEn: Date | null;
  minutosTrabajo: number;
  minutosEspera: number;
  rondasCambios: number;
}

export type ResultadoTransicionEtapa =
  | { ok: true; cambios: CambiosEtapa }
  | { ok: false; motivo: string; codigo?: 400 | 409 };

/**
 * Acumula minutos trabajados (en_curso) o de espera (en_revision) al salir de un estado.
 */
export function acumularTiempos(
  etapa: Pick<EtapaParaTransicion, 'estado' | 'iniciadaEn' | 'enRevisionDesde' | 'minutosTrabajo' | 'minutosEspera'>,
  de: EstadoEtapa,
  a: EstadoEtapa,
  ahora: Date,
): { minutosTrabajo: number; minutosEspera: number } {
  let minutosTrabajo = etapa.minutosTrabajo;
  let minutosEspera = etapa.minutosEspera;

  if (de === 'en_curso' && a !== 'en_curso' && etapa.iniciadaEn) {
    const delta = Math.max(0, Math.round((ahora.getTime() - etapa.iniciadaEn.getTime()) / 60_000));
    minutosTrabajo += delta;
  }
  if (de === 'en_revision' && a !== 'en_revision' && etapa.enRevisionDesde) {
    const delta = Math.max(0, Math.round((ahora.getTime() - etapa.enRevisionDesde.getTime()) / 60_000));
    minutosEspera += delta;
  }

  return { minutosTrabajo, minutosEspera };
}

/**
 * Máquina de estados de una etapa (Sección 3.1).
 */
export function transicionEtapa(
  etapa: EtapaParaTransicion,
  accion: AccionEtapa,
  datos: DatosTransicionEtapa = {},
): ResultadoTransicionEtapa {
  const ahora = datos.ahora ?? new Date();

  if (accion === 'empezar') {
    if (etapa.estado !== 'pendiente') {
      return { ok: false, motivo: 'Solo se puede empezar una etapa pendiente', codigo: 400 };
    }
    if (datos.esEtapaActual === false) {
      return { ok: false, motivo: 'Primero hay que cerrar la etapa anterior antes de empezar esta', codigo: 400 };
    }
    return {
      ok: true,
      cambios: {
        estado: 'en_curso',
        falta: null,
        version: etapa.version,
        iniciadaEn: ahora,
        enRevisionDesde: null,
        cerradaEn: null,
        minutosTrabajo: etapa.minutosTrabajo,
        minutosEspera: etapa.minutosEspera,
        rondasCambios: etapa.rondasCambios,
      },
    };
  }

  if (accion === 'terminar') {
    if (etapa.estado !== 'en_curso') {
      return { ok: false, motivo: 'Solo se puede terminar una etapa en curso', codigo: 400 };
    }
    if (etapa.aprobacion !== 'ninguna') {
      return { ok: false, motivo: 'Esta etapa lleva aprobación: enviala a revisión', codigo: 400 };
    }
    const tiempos = acumularTiempos(etapa, 'en_curso', 'aprobada', ahora);
    return {
      ok: true,
      cambios: {
        estado: 'aprobada',
        falta: null,
        version: etapa.version,
        iniciadaEn: etapa.iniciadaEn,
        enRevisionDesde: null,
        cerradaEn: ahora,
        minutosTrabajo: tiempos.minutosTrabajo,
        minutosEspera: tiempos.minutosEspera,
        rondasCambios: etapa.rondasCambios,
      },
    };
  }

  if (accion === 'enviar_revision') {
    if (etapa.estado !== 'en_curso') {
      return { ok: false, motivo: 'Solo se puede enviar a revisión una etapa en curso', codigo: 400 };
    }
    if (etapa.aprobacion === 'ninguna') {
      return { ok: false, motivo: 'Esta etapa no lleva aprobación: podés terminarla directo', codigo: 400 };
    }
    const tiempos = acumularTiempos(etapa, 'en_curso', 'en_revision', ahora);
    const falta: FaltaAprobacion =
      etapa.aprobacion === 'ambas' || etapa.aprobacion === 'interna' ? 'interna' : 'cliente';
    return {
      ok: true,
      cambios: {
        estado: 'en_revision',
        falta,
        version: etapa.version,
        iniciadaEn: etapa.iniciadaEn,
        enRevisionDesde: ahora,
        cerradaEn: null,
        minutosTrabajo: tiempos.minutosTrabajo,
        minutosEspera: tiempos.minutosEspera,
        rondasCambios: etapa.rondasCambios,
      },
    };
  }

  if (accion === 'aprobar') {
    if (etapa.estado !== 'en_revision') {
      return { ok: false, motivo: 'La etapa no está en revisión', codigo: 400 };
    }
    if (datos.versionAprobada !== undefined && datos.versionAprobada !== etapa.version) {
      return { ok: false, motivo: 'Esa versión ya no es la actual', codigo: 409 };
    }
    const tipo = datos.tipoAprobador ?? (etapa.falta === 'cliente' || etapa.aprobacion === 'cliente' ? 'cliente' : 'interna');

    if (etapa.aprobacion === 'interna' && tipo !== 'interna') {
      return { ok: false, motivo: 'Esta etapa lleva aprobación interna', codigo: 400 };
    }
    if (etapa.aprobacion === 'cliente' && tipo !== 'cliente') {
      return { ok: false, motivo: 'Esta etapa lleva aprobación del cliente', codigo: 400 };
    }
    if (etapa.aprobacion === 'ambas') {
      const faltaActual = etapa.falta ?? 'interna';
      if (tipo !== faltaActual) {
        return {
          ok: false,
          motivo: faltaActual === 'interna' ? 'Primero falta la aprobación interna' : 'Falta la aprobación del cliente',
          codigo: 400,
        };
      }
      if (tipo === 'interna') {
        // Pasa a esperar al cliente sin cambiar versión
        return {
          ok: true,
          cambios: {
            estado: 'en_revision',
            falta: 'cliente',
            version: etapa.version,
            iniciadaEn: etapa.iniciadaEn,
            enRevisionDesde: etapa.enRevisionDesde ?? ahora,
            cerradaEn: null,
            minutosTrabajo: etapa.minutosTrabajo,
            minutosEspera: etapa.minutosEspera,
            rondasCambios: etapa.rondasCambios,
          },
        };
      }
    }

    const tiempos = acumularTiempos(etapa, 'en_revision', 'aprobada', ahora);
    return {
      ok: true,
      cambios: {
        estado: 'aprobada',
        falta: null,
        version: etapa.version,
        iniciadaEn: etapa.iniciadaEn,
        enRevisionDesde: etapa.enRevisionDesde,
        cerradaEn: ahora,
        minutosTrabajo: tiempos.minutosTrabajo,
        minutosEspera: tiempos.minutosEspera,
        rondasCambios: etapa.rondasCambios,
      },
    };
  }

  if (accion === 'pedir_cambios') {
    if (etapa.estado !== 'en_revision') {
      return { ok: false, motivo: 'La etapa no está en revisión', codigo: 400 };
    }
    if (datos.versionAprobada !== undefined && datos.versionAprobada !== etapa.version) {
      return { ok: false, motivo: 'Esa versión ya no es la actual', codigo: 409 };
    }
    if (!datos.comentario?.trim()) {
      return { ok: false, motivo: 'Contá qué cambios hay que hacer', codigo: 400 };
    }
    const tiempos = acumularTiempos(etapa, 'en_revision', 'en_curso', ahora);
    return {
      ok: true,
      cambios: {
        estado: 'en_curso',
        falta: null,
        version: etapa.version + 1,
        iniciadaEn: ahora,
        enRevisionDesde: null,
        cerradaEn: null,
        minutosTrabajo: tiempos.minutosTrabajo,
        minutosEspera: tiempos.minutosEspera,
        rondasCambios: etapa.rondasCambios + 1,
      },
    };
  }

  if (accion === 'omitir') {
    if (etapa.estado !== 'pendiente' && etapa.estado !== 'en_curso') {
      return { ok: false, motivo: 'Solo se puede omitir una etapa pendiente o en curso', codigo: 400 };
    }
    if (!datos.nota?.trim()) {
      return { ok: false, motivo: 'Contá por qué se omite esta etapa', codigo: 400 };
    }
    const tiempos = acumularTiempos(etapa, etapa.estado, 'omitida', ahora);
    return {
      ok: true,
      cambios: {
        estado: 'omitida',
        falta: null,
        version: etapa.version,
        iniciadaEn: etapa.iniciadaEn,
        enRevisionDesde: null,
        cerradaEn: ahora,
        minutosTrabajo: tiempos.minutosTrabajo,
        minutosEspera: tiempos.minutosEspera,
        rondasCambios: etapa.rondasCambios,
      },
    };
  }

  return { ok: false, motivo: 'Acción no reconocida', codigo: 400 };
}

/**
 * Regla 3.2: Quién puede hacer qué en una etapa.
 */
export function puedeOperarEtapa(params: {
  usuarioId: string;
  esDueno: boolean;
  responsableProyectoId: string | null;
  responsableEtapaId: string | null;
}): boolean {
  if (params.esDueno) return true;
  if (params.responsableEtapaId && params.responsableEtapaId === params.usuarioId) return true;
  if (params.responsableProyectoId && params.responsableProyectoId === params.usuarioId) return true;
  // Si no hay responsable asignado ni en la etapa ni en el proyecto, cualquiera con permiso opera.
  if (!params.responsableEtapaId && !params.responsableProyectoId) return true;
  return false;
}

export function puedeAprobarInternamente(params: {
  usuarioId: string;
  esDueno: boolean;
  aprobadorInternoId: string | null;
  responsableProyectoId: string | null;
  enviadoPorUsuarioId: string | null;
}): { ok: true } | { ok: false; motivo: string } {
  if (!params.esDueno && params.enviadoPorUsuarioId && params.enviadoPorUsuarioId === params.usuarioId) {
    return { ok: false, motivo: 'Quien envió la etapa a revisión no puede aprobarla internamente' };
  }
  if (params.esDueno) return { ok: true };
  const designado = params.aprobadorInternoId ?? params.responsableProyectoId;
  if (designado && designado !== params.usuarioId) {
    return { ok: false, motivo: 'Solo el aprobador interno asignado o el dueño puede aprobar esta etapa' };
  }
  return { ok: true };
}

/**
 * Regla 3.3: Calcula las fechas objetivo (AAAA-MM-DD) sumando días corridos desde `fechaInicio`.
 */
export function fechasObjetivo(
  fechaInicio: string,
  etapas: { diasObjetivo: number | null | undefined }[],
  fechaComprometida?: string | null,
): {
  fechas: (string | null)[];
  ultimaFecha: string | null;
  pasaComprometida: boolean;
  aviso: string | null;
} {
  let acumulados = 0;
  const base = new Date(`${fechaInicio.slice(0, 10)}T00:00:00Z`);

  const fechas = etapas.map((e) => {
    if (e.diasObjetivo == null || e.diasObjetivo <= 0) return null;
    acumulados += e.diasObjetivo;
    const d = new Date(base.getTime());
    d.setUTCDate(d.getUTCDate() + acumulados);
    return d.toISOString().slice(0, 10);
  });

  const conFecha = fechas.filter((f): f is string => f !== null);
  const ultimaFecha: string | null = conFecha.length > 0 ? conFecha[conFecha.length - 1]! : null;

  const comprometida = fechaComprometida ? fechaComprometida.slice(0, 10) : null;
  const pasaComprometida = Boolean(ultimaFecha && comprometida && ultimaFecha > comprometida);
  const formatoCorta = (iso: string) => {
    const [, m, d] = iso.split('-');
    return `${d}/${m}`;
  };
  const aviso =
    pasaComprometida && ultimaFecha && comprometida
      ? `Con estos plazos terminás el ${formatoCorta(ultimaFecha)}, después de lo comprometido (${formatoCorta(comprometida)})`
      : null;

  return { fechas, ultimaFecha, pasaComprometida, aviso };
}

function diffDias(desdeIso: string, hastaIso: string): number {
  const a = Date.parse(`${desdeIso.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${hastaIso.slice(0, 10)}T00:00:00Z`);
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/**
 * Regla 3.4: Calcula atraso del proyecto, atraso de etapas y espera al cliente.
 */
export function estadoAtraso(params: {
  estadoProyecto: EstadoProyecto;
  fechaComprometida: string | null;
  terminadoEn: Date | string | null;
  hoy: string;
  ahora?: Date;
  etapas: {
    id?: string;
    orden: number;
    nombre: string;
    estado: EstadoEtapa;
    aprobacion: TipoAprobacion;
    falta: FaltaAprobacion;
    fechaObjetivo: string | null;
    enRevisionDesde: Date | string | null;
  }[];
}): {
  atrasado: boolean;
  diasAtraso: number;
  esperandoCliente: boolean;
  diasEsperandoCliente: number;
  etapaActual: {
    orden: number;
    nombre: string;
    estado: EstadoEtapa;
    falta: FaltaAprobacion;
    atrasada: boolean;
  } | null;
} {
  const hoy = params.hoy.slice(0, 10);
  const ahora = params.ahora ?? new Date(`${hoy}T12:00:00Z`);
  const comp = params.fechaComprometida ? params.fechaComprometida.slice(0, 10) : null;

  let atrasado = false;
  let diasAtraso = 0;

  if (comp) {
    if (params.estadoProyecto === 'activo' || params.estadoProyecto === 'pausado') {
      if (comp < hoy) {
        atrasado = true;
        diasAtraso = diffDias(comp, hoy);
      }
    } else if (params.estadoProyecto === 'terminado' && params.terminadoEn) {
      const termIso =
        typeof params.terminadoEn === 'string'
          ? params.terminadoEn.slice(0, 10)
          : params.terminadoEn.toISOString().slice(0, 10);
      if (termIso > comp) {
        atrasado = true;
        diasAtraso = diffDias(comp, termIso);
      }
    }
  }

  const ordenadas = [...params.etapas].sort((a, b) => a.orden - b.orden);
  const actual = ordenadas.find((e) => e.estado !== 'aprobada' && e.estado !== 'omitida') ?? null;

  let esperandoCliente = false;
  let diasEsperandoCliente = 0;
  for (const e of ordenadas) {
    if (
      e.estado === 'en_revision' &&
      (e.falta === 'cliente' || (e.aprobacion === 'cliente' && e.falta !== 'interna'))
    ) {
      esperandoCliente = true;
      if (e.enRevisionDesde) {
        const desde = typeof e.enRevisionDesde === 'string' ? new Date(e.enRevisionDesde) : e.enRevisionDesde;
        diasEsperandoCliente = Math.max(
          diasEsperandoCliente,
          Math.max(0, Math.floor((ahora.getTime() - desde.getTime()) / 86_400_000)),
        );
      }
    }
  }

  const etapaActual = actual
    ? {
        orden: actual.orden,
        nombre: actual.nombre,
        estado: actual.estado,
        falta: actual.falta,
        atrasada: Boolean(actual.fechaObjetivo && actual.fechaObjetivo.slice(0, 10) < hoy),
      }
    : null;

  return {
    atrasado,
    diasAtraso,
    esperandoCliente,
    diasEsperandoCliente,
    etapaActual,
  };
}

export interface MetricaEtapaResumen {
  nombre: string;
  cantidad: number;
  diasTrabajoPromedio: number;
  diasEsperaPromedio: number;
  rondasCambiosPromedio: number;
}

/**
 * Regla 3.4: Promedios de trabajo, espera (en días con 1 decimal) y rondas de cambios por nombre de etapa.
 */
export function metricasEtapas(
  etapas: { nombre: string; minutosTrabajo: number; minutosEspera: number; rondasCambios: number }[],
): {
  porEtapa: MetricaEtapaResumen[];
  etapaMasDemorada: { nombre: string; diasEsperaPromedio: number } | null;
} {
  const grupos = new Map<
    string,
    { cantidad: number; minTrabajo: number; minEspera: number; rondas: number }
  >();
  for (const e of etapas) {
    const clave = e.nombre.trim();
    const g = grupos.get(clave) ?? { cantidad: 0, minTrabajo: 0, minEspera: 0, rondas: 0 };
    g.cantidad += 1;
    g.minTrabajo += e.minutosTrabajo;
    g.minEspera += e.minutosEspera;
    g.rondas += e.rondasCambios;
    grupos.set(clave, g);
  }

  const redondear1 = (n: number) => Math.round(n * 10) / 10;
  const porEtapa: MetricaEtapaResumen[] = [];
  for (const [nombre, g] of grupos.entries()) {
    porEtapa.push({
      nombre,
      cantidad: g.cantidad,
      diasTrabajoPromedio: redondear1(g.minTrabajo / g.cantidad / 1440),
      diasEsperaPromedio: redondear1(g.minEspera / g.cantidad / 1440),
      rondasCambiosPromedio: redondear1(g.rondas / g.cantidad),
    });
  }

  let etapaMasDemorada: { nombre: string; diasEsperaPromedio: number } | null = null;
  for (const m of porEtapa) {
    if (!etapaMasDemorada || m.diasEsperaPromedio > etapaMasDemorada.diasEsperaPromedio) {
      etapaMasDemorada = { nombre: m.nombre, diasEsperaPromedio: m.diasEsperaPromedio };
    }
  }
  if (etapaMasDemorada && etapaMasDemorada.diasEsperaPromedio <= 0) {
    etapaMasDemorada = null;
  }

  return { porEtapa, etapaMasDemorada };
}

export function codigoProyecto(numero: number): string {
  return `PRY-${String(numero).padStart(6, '0')}`;
}

export function mensajePedidoAprobacion(params: {
  cliente?: string | null;
  proyecto: string;
  etapa: string;
  version: number;
  negocio?: string | null;
}): string {
  const saludo = params.cliente?.trim() ? `Hola ${params.cliente.trim()}!` : 'Hola!';
  const firma = params.negocio?.trim() ? ` — ${params.negocio.trim()}` : '';
  return `${saludo} Te paso para revisar «${params.etapa}» (v${params.version}) de ${params.proyecto}. ¿Nos confirmás si va o qué cambiarías?${firma}`;
}

export interface PlantillaEjemploDef {
  nombre: string;
  descripcion: string;
  orden: number;
  etapas: { orden: number; nombre: string; diasObjetivo: number | null; aprobacion: TipoAprobacion }[];
}

/** Sección 6: Las 4 plantillas de ejemplo que se crean solas la primera vez. */
export const PLANTILLAS_EJEMPLO: readonly PlantillaEjemploDef[] = [
  {
    nombre: 'Campaña',
    descripcion: 'Campaña publicitaria o lanzamiento de punta a punta.',
    orden: 1,
    etapas: [
      { orden: 1, nombre: 'Brief', diasObjetivo: 2, aprobacion: 'cliente' },
      { orden: 2, nombre: 'Estrategia', diasObjetivo: 3, aprobacion: 'ambas' },
      { orden: 3, nombre: 'Piezas', diasObjetivo: 5, aprobacion: 'interna' },
      { orden: 4, nombre: 'Revisión del cliente', diasObjetivo: 3, aprobacion: 'cliente' },
      { orden: 5, nombre: 'Ajustes finales', diasObjetivo: 2, aprobacion: 'interna' },
      { orden: 6, nombre: 'Publicación', diasObjetivo: 1, aprobacion: 'ninguna' },
      { orden: 7, nombre: 'Informe de resultados', diasObjetivo: 5, aprobacion: 'cliente' },
    ],
  },
  {
    nombre: 'Redes mensual',
    descripcion: 'Planificación, piezas y gestión mensual de redes sociales.',
    orden: 2,
    etapas: [
      { orden: 1, nombre: 'Planificación del mes', diasObjetivo: 3, aprobacion: 'ambas' },
      { orden: 2, nombre: 'Producción de piezas', diasObjetivo: 7, aprobacion: 'interna' },
      { orden: 3, nombre: 'Aprobación del calendario', diasObjetivo: 2, aprobacion: 'cliente' },
      { orden: 4, nombre: 'Publicación y comunidad', diasObjetivo: 30, aprobacion: 'ninguna' },
      { orden: 5, nombre: 'Informe mensual', diasObjetivo: 3, aprobacion: 'cliente' },
    ],
  },
  {
    nombre: 'Branding',
    descripcion: 'Identidad visual, concepto y manual de marca.',
    orden: 3,
    etapas: [
      { orden: 1, nombre: 'Brief y referencias', diasObjetivo: 3, aprobacion: 'cliente' },
      { orden: 2, nombre: 'Investigación', diasObjetivo: 5, aprobacion: 'ninguna' },
      { orden: 3, nombre: 'Propuestas de concepto', diasObjetivo: 7, aprobacion: 'ambas' },
      { orden: 4, nombre: 'Desarrollo del elegido', diasObjetivo: 7, aprobacion: 'interna' },
      { orden: 5, nombre: 'Aprobación final', diasObjetivo: 3, aprobacion: 'cliente' },
      { orden: 6, nombre: 'Manual de marca y entrega', diasObjetivo: 5, aprobacion: 'interna' },
    ],
  },
  {
    nombre: 'Genérico',
    descripcion: 'Estructura simple adaptable a cualquier servicio o encargo.',
    orden: 4,
    etapas: [
      { orden: 1, nombre: 'Inicio', diasObjetivo: null, aprobacion: 'ninguna' },
      { orden: 2, nombre: 'Desarrollo', diasObjetivo: null, aprobacion: 'interna' },
      { orden: 3, nombre: 'Revisión del cliente', diasObjetivo: null, aprobacion: 'cliente' },
      { orden: 4, nombre: 'Entrega', diasObjetivo: null, aprobacion: 'ninguna' },
    ],
  },
];

import { describe, expect, it } from 'vitest';
import {
  acumularTiempos,
  estadoAtraso,
  fechasObjetivo,
  mensajePedidoAprobacion,
  metricasEtapas,
  puedeAprobarInternamente,
  transicionEtapa,
  type EtapaParaTransicion,
} from './proyectos.util.js';

function crearEtapaBase(parcial: Partial<EtapaParaTransicion> = {}): EtapaParaTransicion {
  return {
    id: 'et-1',
    orden: 1,
    nombre: 'Estrategia',
    estado: 'pendiente',
    aprobacion: 'ambas',
    falta: null,
    version: 1,
    iniciadaEn: null,
    enRevisionDesde: null,
    cerradaEn: null,
    minutosTrabajo: 0,
    minutosEspera: 0,
    rondasCambios: 0,
    ...parcial,
  };
}

describe('proyectos.util', () => {
  describe('transicionEtapa', () => {
    it('recorre el flujo completo con aprobacion = ambas, pedir cambios y aprobación final', () => {
      const t0 = new Date('2026-11-01T10:00:00Z');
      const r1 = transicionEtapa(crearEtapaBase(), 'empezar', { ahora: t0, esEtapaActual: true });
      expect(r1.ok).toBe(true);
      if (!r1.ok) return;
      expect(r1.cambios.estado).toBe('en_curso');

      // 2 horas de trabajo -> enviar a revisión
      const t1 = new Date('2026-11-01T12:00:00Z');
      const r2 = transicionEtapa({ ...crearEtapaBase(), ...r1.cambios }, 'enviar_revision', { ahora: t1 });
      expect(r2.ok).toBe(true);
      if (!r2.ok) return;
      expect(r2.cambios.estado).toBe('en_revision');
      expect(r2.cambios.falta).toBe('interna');
      expect(r2.cambios.minutosTrabajo).toBe(120);

      // Aprobación interna -> falta pasa a cliente sin cambiar versión
      const t2 = new Date('2026-11-01T13:00:00Z');
      const r3 = transicionEtapa({ ...crearEtapaBase(), ...r2.cambios }, 'aprobar', {
        ahora: t2,
        tipoAprobador: 'interna',
        versionAprobada: 1,
      });
      expect(r3.ok).toBe(true);
      if (!r3.ok) return;
      expect(r3.cambios.estado).toBe('en_revision');
      expect(r3.cambios.falta).toBe('cliente');
      expect(r3.cambios.version).toBe(1);

      // Cliente pide cambios -> vuelve a en_curso, version 2, rondasCambios 1
      const t3 = new Date('2026-11-01T15:00:00Z');
      const r4 = transicionEtapa({ ...crearEtapaBase(), ...r3.cambios }, 'pedir_cambios', {
        ahora: t3,
        versionAprobada: 1,
        comentario: 'Ajustar tono de voz',
      });
      expect(r4.ok).toBe(true);
      if (!r4.ok) return;
      expect(r4.cambios.estado).toBe('en_curso');
      expect(r4.cambios.version).toBe(2);
      expect(r4.cambios.rondasCambios).toBe(1);
      expect(r4.cambios.minutosEspera).toBe(180);

      // Enviar v2 -> aprueba interna -> aprueba cliente -> aprobada
      const t4 = new Date('2026-11-01T16:00:00Z');
      const r5 = transicionEtapa({ ...crearEtapaBase(), ...r4.cambios }, 'enviar_revision', { ahora: t4 });
      expect(r5.ok).toBe(true);
      if (!r5.ok) return;

      const r6 = transicionEtapa({ ...crearEtapaBase(), ...r5.cambios }, 'aprobar', {
        ahora: t4,
        tipoAprobador: 'interna',
        versionAprobada: 2,
      });
      expect(r6.ok).toBe(true);
      if (!r6.ok) return;

      const t5 = new Date('2026-11-01T17:00:00Z');
      const r7 = transicionEtapa({ ...crearEtapaBase(), ...r6.cambios }, 'aprobar', {
        ahora: t5,
        tipoAprobador: 'cliente',
        versionAprobada: 2,
      });
      expect(r7.ok).toBe(true);
      if (!r7.ok) return;
      expect(r7.cambios.estado).toBe('aprobada');
      expect(r7.cambios.falta).toBeNull();
    });

    it('impide empezar una etapa que no es la actual', () => {
      const r = transicionEtapa(crearEtapaBase(), 'empezar', { esEtapaActual: false });
      expect(r.ok).toBe(false);
    });

    it('rechaza con 409 aprobar una versión vieja', () => {
      const etapa = crearEtapaBase({ estado: 'en_revision', falta: 'cliente', aprobacion: 'cliente', version: 2 });
      const r = transicionEtapa(etapa, 'aprobar', { tipoAprobador: 'cliente', versionAprobada: 1 });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.codigo).toBe(409);
        expect(r.motivo).toBe('Esa versión ya no es la actual');
      }
    });

    it('permite omitir con motivo y terminar directo si aprobacion = ninguna', () => {
      const sinMotivo = transicionEtapa(crearEtapaBase(), 'omitir', { nota: '' });
      expect(sinMotivo.ok).toBe(false);

      const conMotivo = transicionEtapa(crearEtapaBase(), 'omitir', { nota: 'No aplica en este proyecto' });
      expect(conMotivo.ok).toBe(true);
      if (conMotivo.ok) expect(conMotivo.cambios.estado).toBe('omitida');

      const sinAprob = crearEtapaBase({ aprobacion: 'ninguna', estado: 'en_curso', iniciadaEn: new Date() });
      const term = transicionEtapa(sinAprob, 'terminar', { ahora: new Date() });
      expect(term.ok).toBe(true);
      if (term.ok) expect(term.cambios.estado).toBe('aprobada');
    });
  });

  describe('regla 3.2: puedeAprobarInternamente', () => {
    it('no permite que quien envió a revisión apruebe adentro, salvo el dueño', () => {
      const noDueno = puedeAprobarInternamente({
        usuarioId: 'u-1',
        esDueno: false,
        aprobadorInternoId: 'u-1',
        responsableProyectoId: 'u-1',
        enviadoPorUsuarioId: 'u-1',
      });
      expect(noDueno.ok).toBe(false);

      const dueno = puedeAprobarInternamente({
        usuarioId: 'u-1',
        esDueno: true,
        aprobadorInternoId: 'u-1',
        responsableProyectoId: 'u-1',
        enviadoPorUsuarioId: 'u-1',
      });
      expect(dueno.ok).toBe(true);
    });
  });

  describe('fechasObjetivo', () => {
    it('suma días corridos, respeta etapas sin plazo y avisa si supera la fecha comprometida', () => {
      const res = fechasObjetivo(
        '2026-11-10',
        [{ diasObjetivo: 5 }, { diasObjetivo: null }, { diasObjetivo: 13 }],
        '2026-11-20',
      );
      expect(res.fechas).toEqual(['2026-11-15', null, '2026-11-28']);
      expect(res.pasaComprometida).toBe(true);
      expect(res.aviso).toBe('Con estos plazos terminás el 28/11, después de lo comprometido (20/11)');
    });
  });

  describe('estadoAtraso', () => {
    it('detecta activo atrasado, terminado tarde, terminado a tiempo y esperando al cliente', () => {
      const activoAtrasado = estadoAtraso({
        estadoProyecto: 'activo',
        fechaComprometida: '2026-11-05',
        terminadoEn: null,
        hoy: '2026-11-08',
        ahora: new Date('2026-11-08T12:00:00Z'),
        etapas: [
          {
            orden: 1,
            nombre: 'Brief',
            estado: 'en_revision',
            aprobacion: 'cliente',
            falta: 'cliente',
            fechaObjetivo: '2026-11-04',
            enRevisionDesde: new Date('2026-11-06T10:00:00Z'),
          },
        ],
      });
      expect(activoAtrasado.atrasado).toBe(true);
      expect(activoAtrasado.diasAtraso).toBe(3);
      expect(activoAtrasado.esperandoCliente).toBe(true);
      expect(activoAtrasado.diasEsperandoCliente).toBe(2);
      expect(activoAtrasado.etapaActual?.atrasada).toBe(true);

      const terminadoTarde = estadoAtraso({
        estadoProyecto: 'terminado',
        fechaComprometida: '2026-11-05',
        terminadoEn: '2026-11-07T15:00:00Z',
        hoy: '2026-11-10',
        etapas: [],
      });
      expect(terminadoTarde.atrasado).toBe(true);
      expect(terminadoTarde.diasAtraso).toBe(2);

      const terminadoATiempo = estadoAtraso({
        estadoProyecto: 'terminado',
        fechaComprometida: '2026-11-05',
        terminadoEn: '2026-11-05T18:00:00Z',
        hoy: '2026-11-10',
        etapas: [],
      });
      expect(terminadoATiempo.atrasado).toBe(false);
      expect(terminadoATiempo.diasAtraso).toBe(0);
    });
  });

  describe('acumularTiempos y metricasEtapas', () => {
    it('acumula minutos de trabajo y espera y calcula promedios por etapa', () => {
      const t1 = acumularTiempos(
        {
          estado: 'en_curso',
          iniciadaEn: new Date('2026-11-01T00:00:00Z'),
          enRevisionDesde: null,
          minutosTrabajo: 1440,
          minutosEspera: 0,
        },
        'en_curso',
        'en_revision',
        new Date('2026-11-02T00:00:00Z'),
      );
      expect(t1.minutosTrabajo).toBe(2880); // 2 días

      const m = metricasEtapas([
        { nombre: 'Revisión del cliente', minutosTrabajo: 1440, minutosEspera: 1440 * 4, rondasCambios: 2 },
        { nombre: 'Revisión del cliente', minutosTrabajo: 1440, minutosEspera: 1440 * 2, rondasCambios: 0 },
      ]);
      expect(m.porEtapa[0]).toEqual({
        nombre: 'Revisión del cliente',
        cantidad: 2,
        diasTrabajoPromedio: 1,
        diasEsperaPromedio: 3,
        rondasCambiosPromedio: 1,
      });
      expect(m.etapaMasDemorada?.nombre).toBe('Revisión del cliente');
    });
  });

  describe('mensajePedidoAprobacion', () => {
    it('arma el mensaje con y sin nombre de cliente', () => {
      expect(
        mensajePedidoAprobacion({
          cliente: 'Laura',
          proyecto: 'Campaña Día de la Madre',
          etapa: 'Piezas',
          version: 2,
          negocio: 'Agencia X',
        }),
      ).toBe(
        'Hola Laura! Te paso para revisar «Piezas» (v2) de Campaña Día de la Madre. ¿Nos confirmás si va o qué cambiarías? — Agencia X',
      );

      expect(
        mensajePedidoAprobacion({
          cliente: null,
          proyecto: 'Web Institucional',
          etapa: 'Boceto',
          version: 1,
        }),
      ).toBe('Hola! Te paso para revisar «Boceto» (v1) de Web Institucional. ¿Nos confirmás si va o qué cambiarías?');
    });
  });
});

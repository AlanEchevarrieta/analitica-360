import { describe, expect, it } from 'vitest';
import { aHoraAR, cuandoTexto, dentroDelHorario, desdeHoraAR, horariosLibres, mensajeRecordatorio, sePisan, validarHorarios } from './agenda.util.js';

const h = (diaSemana: number, desde: string, hasta: string) => ({ diaSemana, desde, hasta });
// 2026-10-15 es jueves (4).
const jueves = [h(4, '09:00', '12:00'), h(4, '15:00', '19:00')];

describe('agenda', () => {
  it('convierte hora de Argentina ida y vuelta', () => {
    const d = desdeHoraAR('2026-10-15T15:30');
    expect(d.toISOString()).toBe('2026-10-15T18:30:00.000Z');
    expect(aHoraAR(d)).toBe('2026-10-15T15:30');
  });

  it('dos turnos pegados no se pisan; uno adentro de otro sí', () => {
    const a = { inicio: desdeHoraAR('2026-10-15T10:00'), fin: desdeHoraAR('2026-10-15T10:30') };
    expect(sePisan(a, { inicio: desdeHoraAR('2026-10-15T10:30'), fin: desdeHoraAR('2026-10-15T11:00') })).toBe(false);
    expect(sePisan(a, { inicio: desdeHoraAR('2026-10-15T10:15'), fin: desdeHoraAR('2026-10-15T10:45') })).toBe(true);
  });

  it('valida los horarios de atención', () => {
    expect(validarHorarios(jueves)).toBeNull();
    expect(validarHorarios([h(4, '12:00', '09:00')])).toContain('antes');
    expect(validarHorarios([h(4, '09:00', '13:00'), h(4, '12:00', '15:00')])).toContain('se pisan');
    expect(validarHorarios([h(4, '9:00', '13:00')])).toContain('09:00');
  });

  it('sabe si un turno cae dentro del horario', () => {
    expect(dentroDelHorario(jueves, '2026-10-15T11:30', 30)).toBe(true);
    expect(dentroDelHorario(jueves, '2026-10-15T11:45', 30)).toBe(false);
    expect(dentroDelHorario(jueves, '2026-10-16T10:00', 30)).toBe(false);
  });

  it('horarios libres: dentro de los tramos, sin pisar turnos, y desde ahora si es hoy', () => {
    const ocupados = [{ inicio: desdeHoraAR('2026-10-15T09:30'), fin: desdeHoraAR('2026-10-15T10:30') }];
    const libres = horariosLibres({ fecha: '2026-10-15', horarios: jueves, ocupados, duracion: 60, paso: 30 });
    expect(libres).toEqual(['10:30', '11:00', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00']);
    expect(horariosLibres({ fecha: '2026-10-15', horarios: jueves, ocupados: [], duracion: 60, paso: 60, ahora: desdeHoraAR('2026-10-15T16:10') })).toEqual(['17:00', '18:00']);
    expect(horariosLibres({ fecha: '2026-10-15', horarios: jueves, ocupados: [], duracion: 30, cerrado: true })).toEqual([]);
  });

  it('el recordatorio dice el día, la hora, el servicio y con quién', () => {
    const inicio = desdeHoraAR('2026-10-15T15:30');
    expect(cuandoTexto(inicio)).toBe('el jueves 15/10 a las 15:30');
    expect(mensajeRecordatorio({ cliente: 'Laura Pérez', servicio: 'Corte', profesional: 'Sofi', inicio, negocio: 'Peluquería Sur' })).toBe(
      'Hola Laura! Te recordamos tu turno de Corte con Sofi el jueves 15/10 a las 15:30. Si no podés venir, avisanos así se lo damos a otra persona. ¡Gracias!\nPeluquería Sur',
    );
  });
});

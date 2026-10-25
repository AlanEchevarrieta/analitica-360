import { describe, expect, it } from 'vitest';
import { Result } from './result.js';
import { mapDomainErrorToHttp, unwrapResult } from './error-mapper.js';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

describe('Result & ErrorMapper', () => {
  it('crea un Result exitoso correctamente', () => {
    const res = Result.ok({ id: '123', total: 500 });
    expect(res.isSuccess).toBe(true);
    expect(res.isFailure).toBe(false);
    expect(res.value).toEqual({ id: '123', total: 500 });
    expect(() => res.error).toThrow();
  });

  it('crea un Result fallido y expone el error', () => {
    const res = Result.notFound('No encontrado');
    expect(res.isSuccess).toBe(false);
    expect(res.isFailure).toBe(true);
    expect(res.error).toEqual({
      kind: 'NOT_FOUND',
      message: 'No encontrado',
      details: undefined,
    });
    expect(() => res.value).toThrow();
  });

  it('desempaqueta el valor con unwrapResult si es exitoso', () => {
    const res = Result.ok('ok-data');
    expect(unwrapResult(res)).toBe('ok-data');
  });

  it('arroja la excepción HTTP correcta al desempaquetar un error', () => {
    const resNotFound = Result.notFound('Item inexistente');
    expect(() => unwrapResult(resNotFound)).toThrow(NotFoundException);

    const resValidation = Result.validation('Dato inválido');
    expect(() => unwrapResult(resValidation)).toThrow(BadRequestException);

    const resConflict = Result.conflict('Ya existe');
    expect(() => unwrapResult(resConflict)).toThrow(ConflictException);
  });

  it('mapea correctamente todos los tipos de DomainError', () => {
    const notFoundHttp = mapDomainErrorToHttp({ kind: 'NOT_FOUND', message: 'test' });
    expect(notFoundHttp).toBeInstanceOf(NotFoundException);

    const conflictHttp = mapDomainErrorToHttp({ kind: 'CONFLICT', message: 'test' });
    expect(conflictHttp).toBeInstanceOf(ConflictException);
  });
});

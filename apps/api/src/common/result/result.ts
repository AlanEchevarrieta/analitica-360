/**
 * Patrón Result para control de flujo funcional y desacoplado (Clean Architecture).
 * Evita arrojar excepciones no controladas a través de las capas de dominio y aplicación.
 */

export type DomainErrorKind =
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'INTERNAL';

export interface DomainError {
  kind: DomainErrorKind;
  message: string;
  details?: unknown;
}

export class Result<T, E = DomainError> {
  private constructor(
    private readonly _isSuccess: boolean,
    private readonly _value?: T,
    private readonly _error?: E,
  ) {}

  get isSuccess(): boolean {
    return this._isSuccess;
  }

  get isFailure(): boolean {
    return !this._isSuccess;
  }

  get value(): T {
    if (!this._isSuccess) {
      throw new Error('No se puede acceder a value en un Result fallido');
    }
    return this._value as T;
  }

  get error(): E {
    if (this._isSuccess) {
      throw new Error('No se puede acceder a error en un Result exitoso');
    }
    return this._error as E;
  }

  static ok<T, E = DomainError>(value: T): Result<T, E> {
    return new Result<T, E>(true, value, undefined);
  }

  static fail<T = never, E = DomainError>(error: E): Result<T, E> {
    return new Result<T, E>(false, undefined, error);
  }

  static notFound(message = 'Recurso no encontrado', details?: unknown): Result<never, DomainError> {
    return Result.fail({ kind: 'NOT_FOUND', message, details });
  }

  static validation(message: string, details?: unknown): Result<never, DomainError> {
    return Result.fail({ kind: 'VALIDATION', message, details });
  }

  static conflict(message: string, details?: unknown): Result<never, DomainError> {
    return Result.fail({ kind: 'CONFLICT', message, details });
  }

  static unauthorized(message = 'No autorizado', details?: unknown): Result<never, DomainError> {
    return Result.fail({ kind: 'UNAUTHORIZED', message, details });
  }

  static forbidden(message = 'Acceso denegado', details?: unknown): Result<never, DomainError> {
    return Result.fail({ kind: 'FORBIDDEN', message, details });
  }

  static internal(message = 'Error interno', details?: unknown): Result<never, DomainError> {
    return Result.fail({ kind: 'INTERNAL', message, details });
  }
}

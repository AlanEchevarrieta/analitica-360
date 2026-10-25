import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { type DomainError, Result } from './result.js';

/**
 * Traduce un DomainError a la excepción HTTP de NestJS correspondiente.
 */
export function mapDomainErrorToHttp(error: DomainError): HttpException {
  switch (error.kind) {
    case 'NOT_FOUND':
      return new NotFoundException(error.message);
    case 'VALIDATION':
      return new BadRequestException(error.message);
    case 'CONFLICT':
      return new ConflictException(error.message);
    case 'UNAUTHORIZED':
      return new UnauthorizedException(error.message);
    case 'FORBIDDEN':
      return new ForbiddenException(error.message);
    case 'INTERNAL':
    default:
      return new InternalServerErrorException(error.message);
  }
}

/**
 * Desempaqueta un Result<T, DomainError> retornando el valor o lanzando la HttpException adecuada.
 */
export function unwrapResult<T>(result: Result<T, DomainError>): T {
  if (result.isFailure) {
    throw mapDomainErrorToHttp(result.error);
  }
  return result.value;
}

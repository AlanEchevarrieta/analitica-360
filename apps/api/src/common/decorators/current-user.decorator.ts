import { createParamDecorator, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { UsuarioContext } from '../auth/request-context.types.js';

/** Requiere haber pasado por EmpresaScopeGuard (usuario ya resuelto). */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): UsuarioContext => {
  const request = ctx.switchToHttp().getRequest<Request>();
  if (!request.usuario) {
    throw new UnauthorizedException('Usuario no resuelto en el contexto de la request');
  }
  return request.usuario;
});

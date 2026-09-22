import { createParamDecorator, type ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import type { EmpresaContext } from '../auth/request-context.types.js';

/** Requiere haber pasado por EmpresaScopeGuard (empresa ya resuelta). */
export const CurrentEmpresa = createParamDecorator((_data: unknown, ctx: ExecutionContext): EmpresaContext => {
  const request = ctx.switchToHttp().getRequest<Request>();
  if (!request.empresa) {
    throw new ForbiddenException('Empresa no resuelta en el contexto de la request');
  }
  return request.empresa;
});

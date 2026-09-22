import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { normalizarRol } from '../auth/rol.types.js';
import { USUARIOS_REPOSITORY, type UsuariosRepository } from '../../modules/usuarios/usuarios.repository.js';

/**
 * Reemplaza estructuralmente lo que hoy hace RLS + get_empresa_id() en
 * Postgres: sin esto, ningún Service de dominio debe confiar en que una
 * query está scopeada a la empresa correcta (ver riesgo "aislamiento
 * multi-tenant sin RLS" en el plan). Corre después de ClerkAuthGuard.
 *
 * Requiere que la sesión de Clerk tenga una organización activa (`org_id`)
 * y que esa organización ya haya sido sincronizada como Empresa vía el
 * webhook (UsuariosModule) — si todavía no llegó el evento del webhook,
 * rechaza con 403 en vez de dejar pasar sin scope.
 */
@Injectable()
export class EmpresaScopeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(USUARIOS_REPOSITORY) private readonly usuariosRepository: UsuariosRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const clerkAuth = request.clerkAuth;
    if (!clerkAuth) {
      throw new UnauthorizedException('EmpresaScopeGuard corrió antes que ClerkAuthGuard');
    }
    if (!clerkAuth.clerkOrgId) {
      throw new ForbiddenException(
        'La sesión no tiene una organización (empresa) activa. Seleccioná una empresa en el OrganizationSwitcher.',
      );
    }

    // Lookups independientes - en paralelo, no en serie. Este guard es
    // global (corre en cada request autenticado), así que una ronda extra
    // de latencia acá pesa en toda la API, no solo en este endpoint.
    const [empresa, usuario] = await Promise.all([
      this.usuariosRepository.findEmpresaByClerkOrgId(clerkAuth.clerkOrgId),
      this.usuariosRepository.findUsuarioByClerkUserId(clerkAuth.clerkUserId),
    ]);
    if (!empresa) {
      throw new ForbiddenException(
        'Empresa no sincronizada todavía (esperando el webhook de Clerk). Reintentá en unos segundos.',
      );
    }
    if (!usuario || usuario.empresaId !== empresa.id) {
      throw new ForbiddenException('Usuario no sincronizado o no pertenece a esta empresa.');
    }

    request.empresa = { id: empresa.id, clerkOrgId: empresa.clerkOrgId, nombre: empresa.nombre };
    request.usuario = {
      id: usuario.id,
      clerkUserId: usuario.clerkUserId,
      empresaId: usuario.empresaId,
      email: usuario.email,
      rol: normalizarRol(usuario.rolCrudo),
      // TODO Fase 3: cargar AccesoColaborador real (tabla colaborador_permisos
      // migrada) para roles 'operador' — hoy dueño/contador ya resuelven sin
      // necesitarlo (ver tieneModulo/tieneAccion en rol.types.ts).
    };
    return true;
  }
}

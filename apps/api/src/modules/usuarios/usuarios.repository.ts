import type { RolCrudo } from '../../common/auth/rol.types.js';

export interface EmpresaRecord {
  id: string;
  clerkOrgId: string;
  nombre: string;
}

export interface UsuarioRecord {
  id: string;
  clerkUserId: string;
  empresaId: string;
  email: string;
  rolCrudo: RolCrudo;
}

export interface UpsertEmpresaInput {
  clerkOrgId: string;
  nombre: string;
}

export interface UpsertUsuarioInput {
  clerkUserId: string;
  empresaId: string;
  email: string;
  rolCrudo: RolCrudo;
}

export const USUARIOS_REPOSITORY = Symbol('USUARIOS_REPOSITORY');

/**
 * Puerto de persistencia de Empresa/Usuario. Implementación real:
 * PrismaUsuariosRepository (Postgres de docker-compose.yml). Ningún
 * consumidor (guards, controllers) debe depender de la implementación
 * concreta, solo de esta interfaz — InMemoryUsuariosRepository queda
 * disponible como test double.
 */
export interface UsuariosRepository {
  upsertEmpresa(input: UpsertEmpresaInput): Promise<EmpresaRecord>;
  upsertUsuario(input: UpsertUsuarioInput): Promise<UsuarioRecord>;
  findEmpresaByClerkOrgId(clerkOrgId: string): Promise<EmpresaRecord | null>;
  findUsuarioByClerkUserId(clerkUserId: string): Promise<UsuarioRecord | null>;
  removeUsuario(clerkUserId: string): Promise<void>;
}

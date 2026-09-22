import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  EmpresaRecord,
  UpsertEmpresaInput,
  UpsertUsuarioInput,
  UsuarioRecord,
  UsuariosRepository,
} from './usuarios.repository.js';

/**
 * TODO Fase 3: reemplazar por PrismaUsuariosRepository contra el Postgres
 * de docker-compose.yml (tablas Empresa/Usuario/RolEmpresa del schema.prisma
 * consolidado). Esta implementación en memoria existe solo para que Fase 2
 * (auth/multi-tenancy) sea funcional y testeable de punta a punta sin
 * Docker/Postgres corriendo todavía. Se pierde el estado en cada restart
 * del proceso — no usar más allá de desarrollo local de esta fase.
 */
@Injectable()
export class InMemoryUsuariosRepository implements UsuariosRepository {
  private readonly empresasPorClerkOrgId = new Map<string, EmpresaRecord>();
  private readonly usuariosPorClerkUserId = new Map<string, UsuarioRecord>();

  async upsertEmpresa(input: UpsertEmpresaInput): Promise<EmpresaRecord> {
    const existente = this.empresasPorClerkOrgId.get(input.clerkOrgId);
    const registro: EmpresaRecord = {
      id: existente?.id ?? randomUUID(),
      clerkOrgId: input.clerkOrgId,
      nombre: input.nombre,
    };
    this.empresasPorClerkOrgId.set(input.clerkOrgId, registro);
    return registro;
  }

  async upsertUsuario(input: UpsertUsuarioInput): Promise<UsuarioRecord> {
    const existente = this.usuariosPorClerkUserId.get(input.clerkUserId);
    const registro: UsuarioRecord = {
      id: existente?.id ?? randomUUID(),
      clerkUserId: input.clerkUserId,
      empresaId: input.empresaId,
      email: input.email,
      rolCrudo: input.rolCrudo,
    };
    this.usuariosPorClerkUserId.set(input.clerkUserId, registro);
    return registro;
  }

  async findEmpresaByClerkOrgId(clerkOrgId: string): Promise<EmpresaRecord | null> {
    return this.empresasPorClerkOrgId.get(clerkOrgId) ?? null;
  }

  async findUsuarioByClerkUserId(clerkUserId: string): Promise<UsuarioRecord | null> {
    return this.usuariosPorClerkUserId.get(clerkUserId) ?? null;
  }

  async removeUsuario(clerkUserId: string): Promise<void> {
    this.usuariosPorClerkUserId.delete(clerkUserId);
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  EmpresaRecord,
  UpsertEmpresaInput,
  UpsertUsuarioInput,
  UsuarioRecord,
  UsuariosRepository,
} from './usuarios.repository.js';

@Injectable()
export class PrismaUsuariosRepository implements UsuariosRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertEmpresa(input: UpsertEmpresaInput): Promise<EmpresaRecord> {
    const empresa = await this.prisma.empresa.upsert({
      where: { clerkOrgId: input.clerkOrgId },
      create: { clerkOrgId: input.clerkOrgId, nombre: input.nombre },
      update: { nombre: input.nombre },
    });
    return { id: empresa.id, clerkOrgId: input.clerkOrgId, nombre: empresa.nombre };
  }

  async upsertUsuario(input: UpsertUsuarioInput): Promise<UsuarioRecord> {
    const usuario = await this.prisma.usuario.upsert({
      where: { clerkUserId: input.clerkUserId },
      // El webhook de Clerk (organizationMembership.created/updated) no manda un
      // nombre propio, solo el identifier (email) - se usa como placeholder de
      // `nombre` hasta que se sume ese campo al evento.
      create: {
        clerkUserId: input.clerkUserId,
        empresaId: input.empresaId,
        nombre: input.email,
        email: input.email,
        rolCrudo: input.rolCrudo,
      },
      update: {
        empresaId: input.empresaId,
        email: input.email,
        rolCrudo: input.rolCrudo,
        deletedAt: null,
      },
    });
    return {
      id: usuario.id,
      clerkUserId: input.clerkUserId,
      empresaId: usuario.empresaId,
      email: usuario.email,
      rolCrudo: usuario.rolCrudo,
    };
  }

  async findEmpresaByClerkOrgId(clerkOrgId: string): Promise<EmpresaRecord | null> {
    const empresa = await this.prisma.empresa.findUnique({ where: { clerkOrgId } });
    if (!empresa) return null;
    return { id: empresa.id, clerkOrgId, nombre: empresa.nombre };
  }

  async findUsuarioByClerkUserId(clerkUserId: string): Promise<UsuarioRecord | null> {
    const usuario = await this.prisma.usuario.findFirst({
      where: { clerkUserId, deletedAt: null },
    });
    if (!usuario) return null;
    return {
      id: usuario.id,
      clerkUserId,
      empresaId: usuario.empresaId,
      email: usuario.email,
      rolCrudo: usuario.rolCrudo,
    };
  }

  async removeUsuario(clerkUserId: string): Promise<void> {
    // Soft delete (deletedAt), consistente con el resto del schema - la
    // membresía se puede reactivar si Clerk manda un alta de nuevo.
    await this.prisma.usuario.updateMany({
      where: { clerkUserId },
      data: { deletedAt: new Date() },
    });
  }
}

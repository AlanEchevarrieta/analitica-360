import { Body, Controller, Get, NotFoundException, BadRequestException, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { z } from 'zod';
import type { EmpresaContext, UsuarioContext } from '../../common/auth/request-context.types.js';
import { ACCIONES, ACCIONES_INICIALES, accesoDesde, MODULOS, MODULOS_INICIALES, normalizarRol, tieneAccion, tieneModulo, type AccionClave, type ModuloClave } from '../../common/auth/rol.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { PrismaService } from '../../database/prisma.service.js';

const permisosSchema = z.object({
  // Configuración queda siempre para el dueño.
  modulos: z.array(z.enum(MODULOS as [ModuloClave, ...ModuloClave[]])).transform((m) => [...new Set(m)].filter((x) => x !== 'configuracion')),
  acciones: z.array(z.enum(ACCIONES as [AccionClave, ...AccionClave[]])).transform((a) => [...new Set(a)]),
});

/** Equipo de la empresa y permisos de cada colaborador (solo el dueño). */
@Controller('equipo')
@Roles('dueno')
export class EquipoController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async listar(@CurrentEmpresa() empresa: EmpresaContext, @CurrentUser() yo: UsuarioContext) {
    const usuarios = await this.prisma.usuario.findMany({
      where: { empresaId: empresa.id, deletedAt: null },
      include: { colaboradorPermiso: true },
      orderBy: { createdAt: 'asc' },
    });
    return usuarios.map((u) => {
      const rol = normalizarRol(u.rolCrudo);
      const acceso =
        rol === 'operador'
          ? u.colaboradorPermiso
            ? { modulos: u.colaboradorPermiso.modulos as Record<ModuloClave, boolean>, acciones: u.colaboradorPermiso.acciones as Record<AccionClave, boolean> }
            : accesoDesde(MODULOS_INICIALES, ACCIONES_INICIALES)
          : undefined;
      return {
        usuarioId: u.id,
        nombre: u.nombre,
        email: u.email,
        rol,
        alta: u.createdAt,
        esYo: u.id === yo.id,
        modulos: MODULOS.filter((m) => tieneModulo(rol, m, acceso)),
        acciones: ACCIONES.filter((a) => tieneAccion(rol, a, acceso)),
        personalizado: Boolean(u.colaboradorPermiso),
      };
    });
  }

  @Put(':usuarioId/permisos')
  async guardar(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
    @Body(new ZodValidationPipe(permisosSchema)) body: z.infer<typeof permisosSchema>,
  ) {
    const usuario = await this.prisma.usuario.findFirst({ where: { id: usuarioId, empresaId: empresa.id, deletedAt: null } });
    if (!usuario) throw new NotFoundException('Esa persona no es de tu equipo');
    if (normalizarRol(usuario.rolCrudo) !== 'operador') throw new BadRequestException('Solo los colaboradores tienen permisos configurables (el dueño ve todo y el contador es de solo lectura)');
    const acceso = accesoDesde(body.modulos, body.acciones);
    await this.prisma.colaboradorPermiso.upsert({
      where: { usuarioId },
      create: { empresaId: empresa.id, usuarioId, modulos: acceso.modulos, acciones: acceso.acciones },
      update: { modulos: acceso.modulos, acciones: acceso.acciones },
    });
    return { ok: true };
  }
}

import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  SUSCRIPCION_REPOSITORY,
  type EstadoSuscripcion,
  type FilaAdminSuscripcion,
  type PlanAdmin,
  type ResultadoAdmin,
  type SuscripcionRepository,
} from './suscripcion.repository.js';
import { AccesoCuentaService } from './acceso-cuenta.service.js';
import type { AccesoCuenta } from './acceso-cuenta.util.js';
import { diasRestantes, estaEnTrial, trialVencido, type SuscripcionActiva } from './suscripcion.util.js';

export interface EstadoSuscripcionRespuesta {
  suscripcion: SuscripcionActiva | null;
  diasRestantes: number;
  enTrial: boolean;
  trialVencido: boolean;
  /** Qué puede hacer la empresa hoy (ver acceso-cuenta.util.ts). */
  acceso: AccesoCuenta;
}

function lanzarSegunMotivo(resultado: ResultadoAdmin): never {
  if (!resultado.ok) {
    if (resultado.motivo === 'empresa_invalida') throw new NotFoundException('Empresa no encontrada');
    if (resultado.motivo === 'plan_invalido') throw new BadRequestException('Plan inválido');
    throw new NotFoundException('Suscripción no encontrada');
  }
  throw new Error('unreachable');
}

@Injectable()
export class SuscripcionService {
  constructor(
    @Inject(SUSCRIPCION_REPOSITORY) private readonly repository: SuscripcionRepository,
    private readonly accesoCuenta: AccesoCuentaService,
  ) {}

  async estado(empresaId: string): Promise<EstadoSuscripcionRespuesta> {
    const suscripcion = await this.repository.activa(empresaId);
    // Recién calculado: activa() puede haber creado la prueba.
    this.accesoCuenta.olvidar(empresaId);
    const acceso = await this.accesoCuenta.de(empresaId);
    return {
      suscripcion,
      diasRestantes: diasRestantes(suscripcion?.fechaVencimiento ?? null),
      enTrial: estaEnTrial(suscripcion),
      trialVencido: trialVencido(suscripcion),
      acceso,
    };
  }

  iniciarPrueba(empresaId: string, usuarioId: string, userAgent: string | null): Promise<void> {
    return this.repository.iniciarPrueba(empresaId, usuarioId, userAgent);
  }

  listarPlanes(): Promise<PlanAdmin[]> {
    return this.repository.listarPlanes();
  }

  listarSuscripciones(): Promise<FilaAdminSuscripcion[]> {
    return this.repository.listarSuscripciones();
  }

  async marcarEmpresaDemo(empresaId: string, esDemo: boolean): Promise<void> {
    const resultado = await this.repository.marcarEmpresaDemo(empresaId, esDemo);
    if (!resultado.ok) lanzarSegunMotivo(resultado);
    this.accesoCuenta.olvidar(empresaId);
  }

  async asignarSuscripcion(empresaId: string, planId: string, fechaVencimiento: string): Promise<void> {
    const resultado = await this.repository.asignarSuscripcion(empresaId, planId, fechaVencimiento);
    if (!resultado.ok) lanzarSegunMotivo(resultado);
    this.accesoCuenta.olvidar(empresaId);
  }

  async cambiarEstadoSuscripcion(suscripcionId: string, estado: EstadoSuscripcion): Promise<void> {
    const resultado = await this.repository.cambiarEstadoSuscripcion(suscripcionId, estado);
    if (!resultado.ok) lanzarSegunMotivo(resultado);
    // Solo tenemos el id de la suscripción: se descarta todo lo guardado.
    this.accesoCuenta.olvidar();
  }
}

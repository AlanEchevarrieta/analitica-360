import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  PROVEEDORES_REPOSITORY,
  type CompraProveedorResumen,
  type GuardarProveedorInput as GuardarProveedorRepo,
  type ListaProveedores,
  type ProveedorRecord,
  type ProveedoresRepository,
} from './proveedores.repository.js';
import type { GuardarProveedorInput, ListarProveedoresQuery } from './proveedores.dto.js';

function normalizar(input: GuardarProveedorInput): GuardarProveedorRepo {
  return {
    nombre: input.nombre,
    razonSocial: input.razonSocial ?? null,
    nombreComercial: input.nombreComercial ?? null,
    cuit: input.cuit ?? null,
    condicionAfip: input.condicionAfip ?? null,
    nombreVendedor: input.nombreVendedor ?? null,
    telefono: input.telefono ?? null,
    email: input.email ?? null,
    productosQueProvee: input.productosQueProvee ?? null,
    condicionesPago: input.condicionesPago ?? null,
    formasPagoAceptadas: input.formasPagoAceptadas,
    plazoEntrega: input.plazoEntrega ?? null,
    cbu: input.cbu ?? null,
    aliasCbu: input.aliasCbu ?? null,
    banco: input.banco ?? null,
    notas: input.notas ?? null,
    activo: input.activo,
  };
}

@Injectable()
export class ProveedoresService {
  constructor(@Inject(PROVEEDORES_REPOSITORY) private readonly proveedoresRepository: ProveedoresRepository) {}

  listar(empresaId: string, query: ListarProveedoresQuery): Promise<ListaProveedores> {
    return this.proveedoresRepository.listar(empresaId, query);
  }

  crear(empresaId: string, input: GuardarProveedorInput): Promise<ProveedorRecord> {
    return this.proveedoresRepository.crear(empresaId, normalizar(input));
  }

  async actualizar(empresaId: string, id: string, input: GuardarProveedorInput): Promise<ProveedorRecord> {
    const proveedor = await this.proveedoresRepository.actualizar(empresaId, id, normalizar(input));
    if (!proveedor) throw new NotFoundException('Proveedor no encontrado');
    return proveedor;
  }

  async buscarPorId(empresaId: string, id: string): Promise<ProveedorRecord> {
    const proveedor = await this.proveedoresRepository.buscarPorId(empresaId, id);
    if (!proveedor) throw new NotFoundException('Proveedor no encontrado');
    return proveedor;
  }

  async ficha(
    empresaId: string,
    id: string,
  ): Promise<{ proveedor: ProveedorRecord; compras: CompraProveedorResumen[] }> {
    const proveedor = await this.buscarPorId(empresaId, id);
    const compras = await this.proveedoresRepository.historialCompras(empresaId, id);
    return { proveedor, compras };
  }
}

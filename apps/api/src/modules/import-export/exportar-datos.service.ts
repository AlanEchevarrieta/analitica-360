import { Inject, Injectable } from '@nestjs/common';
import { EXPORTAR_DATOS_REPOSITORY, type ExportarDatosRepository } from './exportar-datos.repository.js';
import { ClientesService } from '../clientes/clientes.service.js';

export interface ExportCliente {
  nombre: string;
  telefono: string | null;
  ultimaCompra: string | null;
  cantidadCompras: number;
  totalGastado: number;
  etiquetas: string[];
}

@Injectable()
export class ExportarDatosService {
  constructor(
    @Inject(EXPORTAR_DATOS_REPOSITORY) private readonly repository: ExportarDatosRepository,
    private readonly clientesService: ClientesService,
  ) {}

  ventas(empresaId: string) {
    return this.repository.ventas(empresaId);
  }

  productos(empresaId: string) {
    return this.repository.productos(empresaId);
  }

  compras(empresaId: string) {
    return this.repository.compras(empresaId);
  }

  inventario(empresaId: string) {
    return this.repository.inventario(empresaId);
  }

  gastos(empresaId: string) {
    return this.repository.gastos(empresaId);
  }

  // Reusa ClientesService (no hay lógica propia de exportación acá) para no
  // duplicar el cálculo de ultimaCompra/totalGastado/cantidadCompras, que ya
  // vive ahí como una agregación SQL propia (ver aggregarVentasPorCliente).
  async clientes(empresaId: string): Promise<ExportCliente[]> {
    const clientes = await this.clientesService.listar(empresaId);
    return clientes.map((c) => ({
      nombre: c.nombre,
      telefono: c.telefono,
      ultimaCompra: c.ultimaCompra,
      cantidadCompras: c.cantidadCompras,
      totalGastado: c.totalGastado,
      etiquetas: c.etiquetas,
    }));
  }
}

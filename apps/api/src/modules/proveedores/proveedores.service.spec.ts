import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ProveedoresService } from './proveedores.service.js';
import {
  PROVEEDORES_REPOSITORY,
  type ProveedorRecord,
  type ProveedoresRepository,
} from './proveedores.repository.js';

const proveedorBase: ProveedorRecord = {
  id: 'prov-1',
  empresaId: 'empresa-1',
  nombre: 'Distribuidora SRL',
  razonSocial: 'Distribuidora SRL',
  nombreComercial: null,
  cuit: '20304050607',
  condicionAfip: null,
  nombreVendedor: null,
  telefono: null,
  email: null,
  productosQueProvee: null,
  condicionesPago: null,
  formasPagoAceptadas: [],
  plazoEntrega: null,
  cbu: null,
  aliasCbu: null,
  banco: null,
  notas: null,
  activo: true,
};

describe('ProveedoresService', () => {
  let service: ProveedoresService;
  let repository: { [K in keyof ProveedoresRepository]: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    repository = {
      listar: vi.fn(),
      crear: vi.fn(),
      actualizar: vi.fn(),
      buscarPorId: vi.fn(),
      historialCompras: vi.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [ProveedoresService, { provide: PROVEEDORES_REPOSITORY, useValue: repository }],
    }).compile();
    service = module.get(ProveedoresService);
  });

  it('actualizar() lanza NotFoundException cuando el proveedor no existe en esa empresa', async () => {
    repository.actualizar.mockResolvedValue(null);
    await expect(
      service.actualizar('empresa-1', 'prov-x', {
        nombre: 'X',
        razonSocial: null,
        nombreComercial: null,
        cuit: null,
        condicionAfip: null,
        nombreVendedor: null,
        telefono: null,
        email: null,
        productosQueProvee: null,
        condicionesPago: null,
        formasPagoAceptadas: [],
        plazoEntrega: null,
        cbu: null,
        aliasCbu: null,
        banco: null,
        notas: null,
        activo: true,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('buscarPorId() lanza NotFoundException cuando no existe', async () => {
    repository.buscarPorId.mockResolvedValue(null);
    await expect(service.buscarPorId('empresa-1', 'prov-x')).rejects.toThrow(NotFoundException);
  });

  it('ficha() combina el proveedor y su historial de compras', async () => {
    repository.buscarPorId.mockResolvedValue(proveedorBase);
    repository.historialCompras.mockResolvedValue([
      { id: 'compra-1', fecha: '2026-09-01', productos: 'Yerba × 10', total: 5000, notas: null },
    ]);
    const resultado = await service.ficha('empresa-1', 'prov-1');
    expect(resultado.proveedor).toEqual(proveedorBase);
    expect(resultado.compras).toHaveLength(1);
  });
});

import { Test } from '@nestjs/testing';
import { ExportarDatosService } from './exportar-datos.service.js';
import { EXPORTAR_DATOS_REPOSITORY, type ExportarDatosRepository } from './exportar-datos.repository.js';
import { ClientesService } from '../clientes/clientes.service.js';

describe('ExportarDatosService', () => {
  let service: ExportarDatosService;
  let repository: { [K in keyof ExportarDatosRepository]: ReturnType<typeof vi.fn> };
  let clientesService: { listar: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    repository = { ventas: vi.fn(), productos: vi.fn(), compras: vi.fn(), inventario: vi.fn(), gastos: vi.fn() };
    clientesService = { listar: vi.fn() };
    const module = await Test.createTestingModule({
      providers: [
        ExportarDatosService,
        { provide: EXPORTAR_DATOS_REPOSITORY, useValue: repository },
        { provide: ClientesService, useValue: clientesService },
      ],
    }).compile();
    service = module.get(ExportarDatosService);
  });

  it('clientes() reusa ClientesService.listar() y mapea solo los campos relevantes para exportar', async () => {
    clientesService.listar.mockResolvedValue([
      {
        id: 'c1',
        empresaId: 'empresa-1',
        nombre: 'Juana',
        telefono: '123',
        email: 'j@x.com',
        cumpleanos: null,
        notasLibres: null,
        etiquetas: ['vip'],
        ultimaCompra: '2026-09-01',
        totalGastado: 5000,
        cantidadCompras: 3,
      },
    ]);
    const res = await service.clientes('empresa-1');
    expect(clientesService.listar).toHaveBeenCalledWith('empresa-1');
    expect(res).toEqual([{ nombre: 'Juana', telefono: '123', ultimaCompra: '2026-09-01', cantidadCompras: 3, totalGastado: 5000, etiquetas: ['vip'] }]);
  });
});

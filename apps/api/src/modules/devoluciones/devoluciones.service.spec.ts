import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DevolucionesService } from './devoluciones.service.js';
import {
  DEVOLUCIONES_REPOSITORY,
  type DevolucionFicha,
  type DevolucionesRepository,
} from './devoluciones.repository.js';

const fichaBase: DevolucionFicha = {
  id: 'dev-1',
  empresaId: 'empresa-1',
  numero: 1,
  tipo: 'devolucion',
  estado: 'pendiente',
  fecha: new Date('2026-09-22'),
  ventaId: null,
  ventaLabel: null,
  motivo: 'Producto defectuoso',
  notas: null,
  productos: 'Yerba × 1 (trae)',
  items: [],
  movimientos: [],
};

const itemBase = { productoId: 'prod-1', cantidad: 1, precioUnitario: 100, tipo: 'devuelto' as const };

describe('DevolucionesService', () => {
  let service: DevolucionesService;
  let repository: { [K in keyof DevolucionesRepository]: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    repository = {
      listar: vi.fn(),
      ficha: vi.fn(),
      registrar: vi.fn(),
      procesar: vi.fn(),
      cancelar: vi.fn(),
      buscarVentas: vi.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [DevolucionesService, { provide: DEVOLUCIONES_REPOSITORY, useValue: repository }],
    }).compile();
    service = module.get(DevolucionesService);
  });

  it('registrar() devuelve la ficha cuando el repositorio confirma', async () => {
    repository.registrar.mockResolvedValue({ ok: true, devolucion: fichaBase });
    const resultado = await service.registrar('empresa-1', 'user-1', {
      tipo: 'devolucion',
      items: [itemBase],
    });
    expect(resultado).toEqual(fichaBase);
  });

  it.each(['sin_items', 'item_invalido', 'venta_invalida'] as const)(
    'registrar() lanza BadRequestException cuando el repositorio rechaza con motivo %s',
    async (motivo) => {
      repository.registrar.mockResolvedValue({ ok: false, motivo });
      await expect(
        service.registrar('empresa-1', 'user-1', { tipo: 'devolucion', items: [itemBase] }),
      ).rejects.toThrow(BadRequestException);
    },
  );

  it('ficha() lanza NotFoundException cuando no existe en esa empresa', async () => {
    repository.ficha.mockResolvedValue(null);
    await expect(service.ficha('empresa-1', 'dev-x')).rejects.toThrow(NotFoundException);
  });

  it('procesar() lanza NotFoundException cuando no existe', async () => {
    repository.procesar.mockResolvedValue('no_encontrada');
    await expect(service.procesar('empresa-1', 'dev-x')).rejects.toThrow(NotFoundException);
  });

  it('procesar() lanza BadRequestException cuando no está pendiente', async () => {
    repository.procesar.mockResolvedValue('no_pendiente');
    await expect(service.procesar('empresa-1', 'dev-1')).rejects.toThrow(BadRequestException);
  });

  it('cancelar() lanza BadRequestException cuando no está pendiente', async () => {
    repository.cancelar.mockResolvedValue('no_pendiente');
    await expect(service.cancelar('empresa-1', 'user-1', 'dev-1')).rejects.toThrow(BadRequestException);
  });

  it('cancelar() no lanza cuando el repositorio confirma', async () => {
    repository.cancelar.mockResolvedValue('ok');
    await expect(service.cancelar('empresa-1', 'user-1', 'dev-1')).resolves.toBeUndefined();
  });
});

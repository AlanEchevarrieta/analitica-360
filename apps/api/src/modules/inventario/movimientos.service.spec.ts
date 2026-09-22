import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MovimientosService } from './movimientos.service.js';
import {
  MOVIMIENTOS_REPOSITORY,
  type MovimientoRecord,
  type MovimientosRepository,
} from './movimientos.repository.js';

const movimientoBase: MovimientoRecord = {
  id: 'mov-1',
  productoId: 'prod-1',
  varianteId: null,
  loteId: null,
  usuarioId: 'user-1',
  tipo: 'ajuste_positivo',
  cantidad: 10,
  signo: 1,
  costoUnitario: null,
  precioUnitario: null,
  motivo: null,
  ubicacionOrigen: null,
  ubicacionDestino: null,
  referenciaId: null,
  fecha: new Date('2026-09-22'),
};

describe('MovimientosService', () => {
  let service: MovimientosService;
  let repository: { [K in keyof MovimientosRepository]: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    repository = {
      crear: vi.fn(),
      registrarTraslado: vi.fn(),
      listarKardex: vi.fn(),
      calcularStockActual: vi.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [MovimientosService, { provide: MOVIMIENTOS_REPOSITORY, useValue: repository }],
    }).compile();
    service = module.get(MovimientosService);
  });

  it('registrarAjuste() calcula el signo según el tipo y delega al repositorio', async () => {
    repository.crear.mockResolvedValue(movimientoBase);
    await service.registrarAjuste('empresa-1', 'user-1', { productoId: 'prod-1', tipo: 'merma', cantidad: 3 });
    expect(repository.crear).toHaveBeenCalledWith('empresa-1', {
      productoId: 'prod-1',
      varianteId: null,
      usuarioId: 'user-1',
      tipo: 'merma',
      cantidad: 3,
      signo: -1,
      motivo: null,
    });
  });

  it('registrarAjuste() lanza NotFoundException cuando el repositorio devuelve null', async () => {
    repository.crear.mockResolvedValue(null);
    await expect(
      service.registrarAjuste('empresa-1', 'user-1', { productoId: 'prod-x', tipo: 'ajuste_positivo', cantidad: 1 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('registrarTraslado() lanza BadRequestException cuando la ubicación es inválida', async () => {
    repository.registrarTraslado.mockResolvedValue({ ok: false, motivo: 'ubicacion_invalida' });
    await expect(
      service.registrarTraslado('empresa-1', 'user-1', {
        productoId: 'prod-1',
        cantidad: 1,
        origen: 'Casa',
        destino: 'Casa',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('registrarTraslado() lanza NotFoundException cuando el producto no existe', async () => {
    repository.registrarTraslado.mockResolvedValue({ ok: false, motivo: 'producto_no_encontrado' });
    await expect(
      service.registrarTraslado('empresa-1', 'user-1', {
        productoId: 'prod-x',
        cantidad: 1,
        origen: 'Casa',
        destino: 'Stand',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('registrarTrasladoMasivo() se detiene en la primera línea que falla y devuelve lo ya hecho', async () => {
    repository.registrarTraslado
      .mockResolvedValueOnce({ ok: true, movimientos: [movimientoBase, movimientoBase] })
      .mockResolvedValueOnce({ ok: false, motivo: 'ubicacion_invalida' });

    const resultado = await service.registrarTrasladoMasivo('empresa-1', 'user-1', {
      lineas: [
        { productoId: 'prod-1', nombre: 'Producto 1', unidades: 5 },
        { productoId: 'prod-2', nombre: 'Producto 2', unidades: 3 },
        { productoId: 'prod-3', nombre: 'Producto 3', unidades: 2 },
      ],
      origen: 'Casa',
      destino: 'Stand',
    });

    expect(resultado.hechos).toHaveLength(1);
    expect(resultado.error).toContain('Producto 2');
    expect(repository.registrarTraslado).toHaveBeenCalledTimes(2); // no llega a la línea 3
  });

  it('registrarTrasladoMasivo() ignora líneas con unidades <= 0', async () => {
    repository.registrarTraslado.mockResolvedValue({ ok: true, movimientos: [movimientoBase, movimientoBase] });
    const resultado = await service.registrarTrasladoMasivo('empresa-1', 'user-1', {
      lineas: [{ productoId: 'prod-1', nombre: 'Producto 1', unidades: 0 }],
      origen: 'Casa',
      destino: 'Stand',
    });
    expect(repository.registrarTraslado).not.toHaveBeenCalled();
    expect(resultado.hechos).toHaveLength(0);
  });

  it('listarKardex() lanza NotFoundException cuando el producto no existe', async () => {
    repository.listarKardex.mockResolvedValue(null);
    await expect(
      service.listarKardex('empresa-1', 'prod-x', { pagina: 1, pageSize: 20 }),
    ).rejects.toThrow(NotFoundException);
  });
});

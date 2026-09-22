import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { VentasService } from './ventas.service.js';
import { VENTAS_REPOSITORY, type VentaRecord, type VentasRepository } from './ventas.repository.js';

const ventaBase: VentaRecord = {
  id: 'venta-1',
  empresaId: 'empresa-1',
  numeroVenta: '1',
  fecha: new Date('2026-09-22'),
  formaPago: 'efectivo',
  descuento: 0,
  clienteId: null,
  clienteNombre: null,
  cuotas: 1,
  coeficienteInteres: 0,
  totalSinInteres: 1000,
  totalConInteres: 1000,
  notas: null,
  anulada: false,
  esSenia: false,
  montoSenia: 0,
  saldoPendiente: 0,
  estadoCobro: 'pagado',
  fechaCobroSaldo: null,
  productos: 'Yerba × 10',
  total: 1000,
};

const itemBase = { productoId: 'prod-1', cantidad: 10, precioUnitario: 100 };

describe('VentasService', () => {
  let service: VentasService;
  let repository: { [K in keyof VentasRepository]: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    repository = {
      listar: vi.fn(),
      ficha: vi.fn(),
      rango: vi.fn(),
      confirmar: vi.fn(),
      anular: vi.fn(),
      cobrarSaldo: vi.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [VentasService, { provide: VENTAS_REPOSITORY, useValue: repository }],
    }).compile();
    service = module.get(VentasService);
  });

  it('confirmar() devuelve la venta cuando el repositorio confirma', async () => {
    repository.confirmar.mockResolvedValue({ ok: true, venta: ventaBase });
    const resultado = await service.confirmar('empresa-1', 'user-1', {
      items: [itemBase],
      formaPago: 'efectivo',
      descuento: 0,
      cuotas: 1,
      coeficienteInteres: 0,
      esSenia: false,
      montoSenia: 0,
    });
    expect(resultado).toEqual(ventaBase);
  });

  it.each(['sin_productos', 'producto_invalido', 'variante_invalida', 'cliente_invalido', 'ubicacion_invalida', 'senia_invalida'] as const)(
    'confirmar() lanza BadRequestException cuando el repositorio rechaza con motivo %s',
    async (motivo) => {
      repository.confirmar.mockResolvedValue({ ok: false, motivo });
      await expect(
        service.confirmar('empresa-1', 'user-1', {
          items: [itemBase],
          formaPago: 'efectivo',
          descuento: 0,
          cuotas: 1,
          coeficienteInteres: 0,
          esSenia: false,
          montoSenia: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    },
  );

  it('ficha() lanza NotFoundException cuando la venta no existe en esa empresa', async () => {
    repository.ficha.mockResolvedValue(null);
    await expect(service.ficha('empresa-1', 'venta-x')).rejects.toThrow(NotFoundException);
  });

  it('anular() lanza NotFoundException cuando la venta no existe', async () => {
    repository.anular.mockResolvedValue('no_encontrada');
    await expect(service.anular('empresa-1', 'user-1', 'venta-x', { motivo: 'Error de carga' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('anular() lanza BadRequestException cuando ya estaba anulada', async () => {
    repository.anular.mockResolvedValue('ya_anulada');
    await expect(service.anular('empresa-1', 'user-1', 'venta-1', { motivo: 'Error de carga' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('cobrarSaldo() lanza NotFoundException cuando la venta no existe', async () => {
    repository.cobrarSaldo.mockResolvedValue({ ok: false, motivo: 'no_encontrada' });
    await expect(
      service.cobrarSaldo('empresa-1', 'venta-x', { monto: 100, formaPago: 'efectivo', fecha: '2026-09-22' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('cobrarSaldo() lanza BadRequestException cuando no hay saldo pendiente', async () => {
    repository.cobrarSaldo.mockResolvedValue({ ok: false, motivo: 'sin_saldo_pendiente' });
    await expect(
      service.cobrarSaldo('empresa-1', 'venta-1', { monto: 100, formaPago: 'efectivo', fecha: '2026-09-22' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('cobrarSaldo() lanza BadRequestException cuando el monto es inválido', async () => {
    repository.cobrarSaldo.mockResolvedValue({ ok: false, motivo: 'monto_invalido' });
    await expect(
      service.cobrarSaldo('empresa-1', 'venta-1', { monto: 999999, formaPago: 'efectivo', fecha: '2026-09-22' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('cobrarSaldo() devuelve la venta actualizada cuando el repositorio confirma', async () => {
    repository.cobrarSaldo.mockResolvedValue({ ok: true, venta: ventaBase });
    const resultado = await service.cobrarSaldo('empresa-1', 'venta-1', {
      monto: 100,
      formaPago: 'efectivo',
      fecha: '2026-09-22',
    });
    expect(resultado).toEqual(ventaBase);
  });
});

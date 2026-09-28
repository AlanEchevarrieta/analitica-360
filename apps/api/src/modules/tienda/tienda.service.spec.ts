import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TiendaService } from './tienda.service.js';
import { TIENDA_REPOSITORY, type TiendaRepository } from './tienda.repository.js';
import { PEDIDOS_REPOSITORY, type PedidoFicha, type PedidosRepository } from '../pedidos/pedidos.repository.js';
import type { CrearPedidoTiendaInput } from './tienda.dto.js';

const PROD_SIMPLE = '11111111-1111-4111-8111-111111111111';
const PROD_VARIANTES = '22222222-2222-4222-8222-222222222222';
const VARIANTE = '33333333-3333-4333-8333-333333333333';

const fichaCreada = { id: 'ped-1', numeroPedido: 'PED-7' } as PedidoFicha;

const inputBase: CrearPedidoTiendaInput = {
  clienteNombre: 'Ana',
  clienteEmail: 'ana@example.com',
  clienteTelefono: '2615555555',
  direccionEnvio: 'San Martín 100',
  codigoPostal: '5500',
  localidad: 'Mendoza',
  provincia: 'Mendoza',
  notas: '',
  items: [{ productoId: PROD_SIMPLE, cantidad: 2 }],
};

describe('TiendaService', () => {
  let service: TiendaService;
  let tienda: { [K in keyof TiendaRepository]: ReturnType<typeof vi.fn> };
  let pedidos: Pick<{ [K in keyof PedidosRepository]: ReturnType<typeof vi.fn> }, 'crear'>;

  beforeEach(async () => {
    tienda = {
      empresaActiva: vi.fn().mockResolvedValue(true),
      pedidoMinimo: vi.fn().mockResolvedValue(null),
      catalogo: vi.fn().mockResolvedValue([]),
      productosVendibles: vi.fn().mockResolvedValue([
        { id: PROD_SIMPLE, precio: 5000, variantes: [] },
        { id: PROD_VARIANTES, precio: 49000, variantes: [{ id: VARIANTE, precio: 45000 }] },
      ]),
    };
    pedidos = { crear: vi.fn().mockResolvedValue({ ok: true, pedido: fichaCreada }) };
    const module = await Test.createTestingModule({
      providers: [
        TiendaService,
        { provide: TIENDA_REPOSITORY, useValue: tienda },
        { provide: PEDIDOS_REPOSITORY, useValue: pedidos },
      ],
    }).compile();
    service = module.get(TiendaService);
  });

  it('catalogo() responde 404 si la empresa no existe o está inactiva', async () => {
    tienda.empresaActiva.mockResolvedValue(false);
    await expect(service.catalogo('empresa-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(tienda.catalogo).not.toHaveBeenCalled();
  });

  it('crearPedido() rechaza compras por debajo del mínimo configurado', async () => {
    tienda.pedidoMinimo.mockResolvedValue(20000);
    // 2 × $5.000 = $10.000 < $20.000
    await expect(service.crearPedido('empresa-1', inputBase)).rejects.toThrow(/compra mínima/);
    expect(pedidos.crear).not.toHaveBeenCalled();
    tienda.pedidoMinimo.mockResolvedValue(10000);
    await expect(service.crearPedido('empresa-1', inputBase)).resolves.toMatchObject({ total: 10000 });
  });

  it('crearPedido() usa el precio de la base y origen tienda_online', async () => {
    const resultado = await service.crearPedido('empresa-1', {
      ...inputBase,
      items: [
        { productoId: PROD_SIMPLE, cantidad: 2 },
        { productoId: PROD_VARIANTES, varianteId: VARIANTE, cantidad: 1 },
      ],
    });

    expect(pedidos.crear).toHaveBeenCalledWith(
      'empresa-1',
      expect.objectContaining({
        origen: 'tienda_online',
        notas: null,
        items: [
          { productoId: PROD_SIMPLE, varianteId: null, cantidad: 2, precioUnitario: 5000 },
          { productoId: PROD_VARIANTES, varianteId: VARIANTE, cantidad: 1, precioUnitario: 45000 },
        ],
      }),
    );
    expect(resultado).toEqual({ id: 'ped-1', numeroPedido: 'PED-7', total: 55000 });
  });

  it('crearPedido() rechaza productos que no están a la venta', async () => {
    tienda.productosVendibles.mockResolvedValue([]);
    await expect(service.crearPedido('empresa-1', inputBase)).rejects.toBeInstanceOf(BadRequestException);
    expect(pedidos.crear).not.toHaveBeenCalled();
  });

  it('crearPedido() exige variante cuando el producto tiene variantes activas', async () => {
    await expect(
      service.crearPedido('empresa-1', { ...inputBase, items: [{ productoId: PROD_VARIANTES, cantidad: 1 }] }),
    ).rejects.toThrow('Elegí una variante del producto');
  });

  it('crearPedido() rechaza una variante que no pertenece al producto', async () => {
    await expect(
      service.crearPedido('empresa-1', {
        ...inputBase,
        items: [{ productoId: PROD_SIMPLE, varianteId: VARIANTE, cantidad: 1 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('crearPedido() responde 404 si la empresa no existe', async () => {
    tienda.empresaActiva.mockResolvedValue(false);
    await expect(service.crearPedido('empresa-1', inputBase)).rejects.toBeInstanceOf(NotFoundException);
    expect(pedidos.crear).not.toHaveBeenCalled();
  });
});

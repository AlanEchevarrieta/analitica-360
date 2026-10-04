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
  formaPago: 'a_coordinar',
};

const cuponBase = { codigo: 'ACACIA10', tipo: 'porcentaje' as const, valor: 10, compraMinima: null, desde: null, hasta: null, usosMax: null, usos: 0, activo: true };

describe('TiendaService', () => {
  let service: TiendaService;
  let tienda: { [K in keyof TiendaRepository]: ReturnType<typeof vi.fn> };
  let pedidos: Pick<{ [K in keyof PedidosRepository]: ReturnType<typeof vi.fn> }, 'crear'>;

  beforeEach(async () => {
    tienda = {
      empresaActiva: vi.fn().mockResolvedValue(true),
      pedidoMinimo: vi.fn().mockResolvedValue(null),
      condiciones: vi.fn().mockResolvedValue({ pedidoMinimo: null, descuentoTransferencia: 0 }),
      catalogo: vi.fn().mockResolvedValue([]),
      cupon: vi.fn().mockResolvedValue(null),
      usarCupon: vi.fn().mockResolvedValue(true),
      devolverCupon: vi.fn().mockResolvedValue(undefined),
      productosVendibles: vi.fn().mockResolvedValue([
        { id: PROD_SIMPLE, precio: 5000, oferta: null, variantes: [] },
        { id: PROD_VARIANTES, precio: 49000, oferta: null, variantes: [{ id: VARIANTE, precio: 45000 }] },
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
    tienda.condiciones.mockResolvedValue({ pedidoMinimo: 20000, descuentoTransferencia: 0 });
    // 2 × $5.000 = $10.000 < $20.000
    await expect(service.crearPedido('empresa-1', inputBase)).rejects.toThrow(/compra mínima/);
    expect(pedidos.crear).not.toHaveBeenCalled();
    tienda.condiciones.mockResolvedValue({ pedidoMinimo: 10000, descuentoTransferencia: 0 });
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
    expect(resultado).toEqual({ id: 'ped-1', numeroPedido: 'PED-7', subtotal: 55000, descuentoCupon: 0, descuentoTransferencia: 0, total: 55000 });
  });

  it('crearPedido() aplica la oferta vigente en el precio del ítem (también a las variantes)', async () => {
    tienda.productosVendibles.mockResolvedValue([
      { id: PROD_VARIANTES, precio: 49000, oferta: { tipo: 'porcentaje', valor: 20, desde: null, hasta: null }, variantes: [{ id: VARIANTE, precio: 45000 }] },
    ]);
    const r = await service.crearPedido('empresa-1', { ...inputBase, items: [{ productoId: PROD_VARIANTES, varianteId: VARIANTE, cantidad: 2 }] });
    expect(pedidos.crear).toHaveBeenCalledWith(
      'empresa-1',
      expect.objectContaining({
        items: [{ productoId: PROD_VARIANTES, varianteId: VARIANTE, cantidad: 2, precioUnitario: 36000 }],
        descuentos: expect.objectContaining({ ofertas: 18000 }),
      }),
    );
    expect(r.total).toBe(72000);
  });

  it('crearPedido() con cupón y transferencia: los descuentos los calcula el servidor', async () => {
    tienda.cupon.mockResolvedValue(cuponBase);
    tienda.condiciones.mockResolvedValue({ pedidoMinimo: null, descuentoTransferencia: 10 });
    const r = await service.crearPedido('empresa-1', { ...inputBase, items: [{ productoId: PROD_VARIANTES, varianteId: VARIANTE, cantidad: 1 }], cuponCodigo: ' acacia10 ', formaPago: 'transferencia' });
    // 45.000 − 10% cupón = 40.500 − 10% transferencia = 36.450
    expect(r).toMatchObject({ subtotal: 45000, descuentoCupon: 4500, descuentoTransferencia: 4050, total: 36450 });
    expect(tienda.usarCupon).toHaveBeenCalledWith('empresa-1', 'ACACIA10');
    expect(pedidos.crear).toHaveBeenCalledWith('empresa-1', expect.objectContaining({ descuentos: { cuponCodigo: 'ACACIA10', ofertas: 0, cupon: 4500, transferencia: 4050, formaPago: 'transferencia' } }));
  });

  it('crearPedido() con un cupón inválido no crea nada', async () => {
    tienda.cupon.mockResolvedValue({ ...cuponBase, hasta: '2020-01-01' });
    await expect(service.crearPedido('empresa-1', { ...inputBase, cuponCodigo: 'ACACIA10' })).rejects.toThrow(/vencido/);
    expect(tienda.usarCupon).not.toHaveBeenCalled();
    expect(pedidos.crear).not.toHaveBeenCalled();
  });

  it('crearPedido(): si el cupón se agotó justo antes (otra compra), rechaza; si el pedido falla, devuelve el uso', async () => {
    tienda.cupon.mockResolvedValue({ ...cuponBase, usosMax: 1 });
    tienda.usarCupon.mockResolvedValueOnce(false);
    await expect(service.crearPedido('empresa-1', { ...inputBase, cuponCodigo: 'ACACIA10' })).rejects.toThrow(/todas las veces/);
    expect(pedidos.crear).not.toHaveBeenCalled();

    pedidos.crear.mockResolvedValueOnce({ ok: false, motivo: 'producto_invalido' });
    await expect(service.crearPedido('empresa-1', { ...inputBase, cuponCodigo: 'ACACIA10' })).rejects.toThrow(BadRequestException);
    expect(tienda.devolverCupon).toHaveBeenCalledWith('empresa-1', 'ACACIA10');
  });

  it('validarCupon() explica por qué no vale', async () => {
    tienda.cupon.mockResolvedValue({ ...cuponBase, compraMinima: 30000 });
    await expect(service.validarCupon('empresa-1', { codigo: 'acacia10', subtotal: 20000 })).resolves.toEqual({ valido: false, mensaje: expect.stringMatching(/compras desde \$\s?30\.000/) });
    await expect(service.validarCupon('empresa-1', { codigo: 'acacia10', subtotal: 40000 })).resolves.toEqual({ valido: true, codigo: 'ACACIA10', descuento: 4000 });
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

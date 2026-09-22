import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PedidosService } from './pedidos.service.js';
import { PEDIDOS_REPOSITORY, type PedidoFicha, type PedidosRepository } from './pedidos.repository.js';

const fichaBase: PedidoFicha = {
  id: 'ped-1',
  empresaId: 'empresa-1',
  numeroPedido: 'PED-1',
  clienteId: null,
  clienteNombre: 'Juan',
  origen: 'manual',
  estado: 'nuevo',
  asignadoAId: null,
  total: 1000,
  createdAt: new Date('2026-09-22'),
  clienteEmail: null,
  clienteTelefono: null,
  direccionEnvio: null,
  codigoPostal: null,
  localidad: null,
  provincia: null,
  metodoEnvio: null,
  numeroSeguimiento: null,
  transportista: null,
  notas: null,
  items: [],
};

const itemBase = { productoId: 'prod-1', cantidad: 5, precioUnitario: 200 };

describe('PedidosService', () => {
  let service: PedidosService;
  let repository: { [K in keyof PedidosRepository]: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    repository = {
      listar: vi.fn(),
      ficha: vi.fn(),
      crear: vi.fn(),
      asignar: vi.fn(),
      guardarPreparacionItem: vi.fn(),
      marcarTodoPreparado: vi.fn(),
      confirmarListoDespacho: vi.fn(),
      registrarDespacho: vi.fn(),
      marcarConTransportista: vi.fn(),
      marcarEntregado: vi.fn(),
      cancelar: vi.fn(),
      colaboradoresActivos: vi.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [PedidosService, { provide: PEDIDOS_REPOSITORY, useValue: repository }],
    }).compile();
    service = module.get(PedidosService);
  });

  it('crear() devuelve la ficha cuando el repositorio confirma', async () => {
    repository.crear.mockResolvedValue({ ok: true, pedido: fichaBase });
    const resultado = await service.crear('empresa-1', { items: [itemBase] });
    expect(resultado).toEqual(fichaBase);
  });

  it.each(['sin_items', 'producto_invalido', 'variante_invalida', 'cliente_invalido'] as const)(
    'crear() lanza BadRequestException cuando el repositorio rechaza con motivo %s',
    async (motivo) => {
      repository.crear.mockResolvedValue({ ok: false, motivo });
      await expect(service.crear('empresa-1', { items: [itemBase] })).rejects.toThrow(BadRequestException);
    },
  );

  it('asignar() lanza BadRequestException cuando el usuario no pertenece a la empresa', async () => {
    repository.asignar.mockResolvedValue('usuario_invalido');
    await expect(service.asignar('empresa-1', 'ped-1', { usuarioId: 'user-ajeno' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('confirmarListoDespacho() lanza BadRequestException cuando hay items incompletos', async () => {
    repository.confirmarListoDespacho.mockResolvedValue({ ok: false, motivo: 'incompleto' });
    await expect(service.confirmarListoDespacho('empresa-1', 'ped-1')).rejects.toThrow(BadRequestException);
  });

  it('registrarDespacho() lanza BadRequestException cuando el pedido no está listo para despacho', async () => {
    repository.registrarDespacho.mockResolvedValue({ ok: false, motivo: 'no_listo_despacho' });
    await expect(
      service.registrarDespacho('empresa-1', 'user-1', 'ped-1', {}),
    ).rejects.toThrow(BadRequestException);
  });

  it('registrarDespacho() lanza BadRequestException cuando la ubicación no pertenece a la empresa', async () => {
    repository.registrarDespacho.mockResolvedValue({ ok: false, motivo: 'ubicacion_invalida' });
    await expect(
      service.registrarDespacho('empresa-1', 'user-1', 'ped-1', { ubicacionOrigen: 'Ajena' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('cancelar() lanza NotFoundException cuando no existe', async () => {
    repository.cancelar.mockResolvedValue('no_encontrado');
    await expect(service.cancelar('empresa-1', 'ped-x')).rejects.toThrow(NotFoundException);
  });

  it('cancelar() lanza BadRequestException cuando el pedido ya fue despachado', async () => {
    repository.cancelar.mockResolvedValue('estado_invalido');
    await expect(service.cancelar('empresa-1', 'ped-1')).rejects.toThrow(BadRequestException);
  });

  it('marcarEntregado() no lanza cuando el repositorio confirma', async () => {
    repository.marcarEntregado.mockResolvedValue('ok');
    await expect(service.marcarEntregado('empresa-1', 'ped-1')).resolves.toBeUndefined();
  });
});

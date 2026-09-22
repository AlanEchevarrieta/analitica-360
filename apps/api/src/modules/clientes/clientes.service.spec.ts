import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ClientesService } from './clientes.service.js';
import { CLIENTES_REPOSITORY, type ClienteRecord, type ClientesRepository } from './clientes.repository.js';

const clienteBase: ClienteRecord = {
  id: 'cli-1',
  empresaId: 'empresa-1',
  nombre: 'Ana',
  telefono: null,
  email: null,
  cumpleanos: null,
  notasLibres: null,
  etiquetas: [],
  ultimaCompra: null,
  totalGastado: 0,
  cantidadCompras: 0,
};

describe('ClientesService', () => {
  let service: ClientesService;
  let repository: { [K in keyof ClientesRepository]: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    repository = {
      listar: vi.fn(),
      ficha: vi.fn(),
      crear: vi.fn(),
      actualizar: vi.fn(),
      agregarInteraccion: vi.fn(),
      segmentos: vi.fn(),
      cumpleanosProximos: vi.fn(),
      cumpleanosMes: vi.fn(),
      listarDifusiones: vi.fn(),
      guardarDifusion: vi.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [ClientesService, { provide: CLIENTES_REPOSITORY, useValue: repository }],
    }).compile();
    service = module.get(ClientesService);
  });

  it('actualizar() lanza NotFoundException cuando el cliente no existe en esa empresa', async () => {
    repository.actualizar.mockResolvedValue(null);
    await expect(
      service.actualizar('empresa-1', 'cli-x', { nombre: 'X', etiquetas: [] }),
    ).rejects.toThrow(NotFoundException);
  });

  it('ficha() lanza NotFoundException cuando no existe', async () => {
    repository.ficha.mockResolvedValue(null);
    await expect(service.ficha('empresa-1', 'cli-x')).rejects.toThrow(NotFoundException);
  });

  it('agregarInteraccion() lanza NotFoundException cuando el cliente no existe en esa empresa', async () => {
    repository.agregarInteraccion.mockResolvedValue('cliente_invalido');
    await expect(
      service.agregarInteraccion('empresa-1', 'user-1', 'cli-x', { tipo: 'nota', contenido: 'Hola', privado: false }),
    ).rejects.toThrow(NotFoundException);
  });

  it('agregarInteraccion() no lanza cuando el repositorio confirma', async () => {
    repository.agregarInteraccion.mockResolvedValue('ok');
    await expect(
      service.agregarInteraccion('empresa-1', 'user-1', 'cli-1', { tipo: 'nota', contenido: 'Hola', privado: false }),
    ).resolves.toBeUndefined();
  });

  it('guardarDifusion() lanza BadRequestException cuando no hay destinatarios', async () => {
    await expect(
      service.guardarDifusion('empresa-1', 'user-1', { segmento: 'vip', mensaje: 'Hola', cantidad: 0 }),
    ).rejects.toThrow(BadRequestException);
    expect(repository.guardarDifusion).not.toHaveBeenCalled();
  });

  it('guardarDifusion() delega al repositorio cuando hay destinatarios', async () => {
    repository.guardarDifusion.mockResolvedValue({ id: 'dif-1', segmento: 'vip', mensaje: 'Hola', cantidad: 5, fecha: new Date() });
    await service.guardarDifusion('empresa-1', 'user-1', { segmento: 'vip', mensaje: 'Hola', cantidad: 5 });
    expect(repository.guardarDifusion).toHaveBeenCalledWith('empresa-1', {
      usuarioId: 'user-1',
      segmento: 'vip',
      mensaje: 'Hola',
      cantidad: 5,
    });
  });

  it('crear() delega al repositorio con los campos opcionales normalizados a null', async () => {
    repository.crear.mockResolvedValue(clienteBase);
    await service.crear('empresa-1', { nombre: 'Ana', etiquetas: [] });
    expect(repository.crear).toHaveBeenCalledWith('empresa-1', {
      nombre: 'Ana',
      telefono: null,
      email: null,
      cumpleanos: null,
      notasLibres: null,
      etiquetas: [],
    });
  });
});

import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AtributosService } from './atributos.service.js';
import {
  ATRIBUTOS_REPOSITORY,
  type AtributoRecord,
  type AtributosRepository,
} from './atributos.repository.js';
import { ATRIBUTOS_DEFAULT } from './variantes.util.js';

const atributoBase: AtributoRecord = {
  id: 'atr-1',
  empresaId: 'empresa-1',
  nombre: 'Color',
  valores: ['Rojo', 'Azul'],
  activoVentas: true,
};

describe('AtributosService', () => {
  let service: AtributosService;
  let repository: { [K in keyof AtributosRepository]: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    repository = {
      listar: vi.fn(),
      crear: vi.fn(),
      actualizar: vi.fn(),
      eliminar: vi.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [AtributosService, { provide: ATRIBUTOS_REPOSITORY, useValue: repository }],
    }).compile();
    service = module.get(AtributosService);
  });

  it('crear() deduplica los valores repetidos', async () => {
    repository.crear.mockResolvedValue(atributoBase);
    await service.crear('empresa-1', { nombre: 'Color', valores: ['Rojo', 'Rojo', 'Azul'], activoVentas: true });
    expect(repository.crear).toHaveBeenCalledWith('empresa-1', {
      nombre: 'Color',
      valores: ['Rojo', 'Azul'],
      activoVentas: true,
    });
  });

  it('actualizar() lanza NotFoundException cuando el repositorio no encuentra el atributo en esa empresa', async () => {
    repository.actualizar.mockResolvedValue(null);
    await expect(
      service.actualizar('empresa-1', 'atr-x', { nombre: 'X', valores: ['a'], activoVentas: true }),
    ).rejects.toThrow(NotFoundException);
  });

  it('eliminar() lanza NotFoundException cuando el repositorio devuelve false', async () => {
    repository.eliminar.mockResolvedValue(false);
    await expect(service.eliminar('empresa-1', 'atr-x')).rejects.toThrow(NotFoundException);
  });

  it('sembrarDefault() no crea nada si ya hay atributos', async () => {
    repository.listar.mockResolvedValue([atributoBase]);
    const resultado = await service.sembrarDefault('empresa-1');
    expect(repository.crear).not.toHaveBeenCalled();
    expect(resultado).toEqual([atributoBase]);
  });

  it('sembrarDefault() crea el catálogo default cuando la empresa no tiene ninguno', async () => {
    repository.listar.mockResolvedValueOnce([]).mockResolvedValueOnce(ATRIBUTOS_DEFAULT.map((d, i) => ({ ...atributoBase, id: `d${i}`, nombre: d.nombre, valores: d.valores })));
    repository.crear.mockResolvedValue(atributoBase);
    await service.sembrarDefault('empresa-1');
    expect(repository.crear).toHaveBeenCalledTimes(ATRIBUTOS_DEFAULT.length);
  });
});

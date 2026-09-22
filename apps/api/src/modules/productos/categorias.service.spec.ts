import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CategoriasService } from './categorias.service.js';
import {
  CATEGORIAS_REPOSITORY,
  type CategoriaRecord,
  type CategoriasRepository,
} from './categorias.repository.js';

const categoriaBase: CategoriaRecord = {
  id: 'cat-1',
  empresaId: 'empresa-1',
  nombre: 'Bebidas',
  descripcion: null,
  activo: true,
};

describe('CategoriasService', () => {
  let service: CategoriasService;
  let repository: { [K in keyof CategoriasRepository]: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    repository = {
      crear: vi.fn(),
      actualizar: vi.fn(),
      eliminar: vi.fn(),
      listar: vi.fn(),
      buscarPorId: vi.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [CategoriasService, { provide: CATEGORIAS_REPOSITORY, useValue: repository }],
    }).compile();
    service = module.get(CategoriasService);
  });

  it('crear() recorta la descripción vacía a null', async () => {
    repository.crear.mockResolvedValue(categoriaBase);
    await service.crear('empresa-1', { nombre: 'Bebidas', descripcion: '   ', activo: true });
    expect(repository.crear).toHaveBeenCalledWith({
      empresaId: 'empresa-1',
      nombre: 'Bebidas',
      descripcion: null,
      activo: true,
    });
  });

  it('actualizar() lanza NotFoundException cuando el repositorio no encuentra la categoría en esa empresa', async () => {
    repository.actualizar.mockResolvedValue(null);
    await expect(
      service.actualizar('empresa-1', 'cat-x', { nombre: 'X', activo: true }),
    ).rejects.toThrow(NotFoundException);
  });

  it('eliminar() lanza NotFoundException cuando el repositorio devuelve false', async () => {
    repository.eliminar.mockResolvedValue(false);
    await expect(service.eliminar('empresa-1', 'cat-x')).rejects.toThrow(NotFoundException);
  });

  it('eliminar() no lanza cuando el repositorio confirma la baja', async () => {
    repository.eliminar.mockResolvedValue(true);
    await expect(service.eliminar('empresa-1', 'cat-1')).resolves.toBeUndefined();
  });
});

import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UbicacionesService } from './ubicaciones.service.js';
import {
  UBICACIONES_REPOSITORY,
  type UbicacionRecord,
  type UbicacionesRepository,
} from './ubicaciones.repository.js';

const ubicacionBase: UbicacionRecord = {
  id: 'ubi-1',
  empresaId: 'empresa-1',
  nombre: 'Casa',
  descripcion: null,
  tipo: 'deposito',
  activo: true,
};

describe('UbicacionesService', () => {
  let service: UbicacionesService;
  let repository: { [K in keyof UbicacionesRepository]: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    repository = {
      listar: vi.fn(),
      crear: vi.fn(),
      actualizar: vi.fn(),
      buscarPorId: vi.fn(),
      eliminar: vi.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [UbicacionesService, { provide: UBICACIONES_REPOSITORY, useValue: repository }],
    }).compile();
    service = module.get(UbicacionesService);
  });

  it('actualizar() lanza NotFoundException cuando el repositorio no encuentra la ubicación en esa empresa', async () => {
    repository.actualizar.mockResolvedValue({ ok: false, motivo: 'no_encontrada' });
    await expect(
      service.actualizar('empresa-1', 'ubi-x', { nombre: 'X', tipo: 'otro', activo: true }),
    ).rejects.toThrow(NotFoundException);
  });

  it('crear() lanza ConflictException cuando el nombre ya existe en la empresa', async () => {
    repository.crear.mockResolvedValue({ ok: false, motivo: 'nombre_duplicado' });
    await expect(
      service.crear('empresa-1', { nombre: 'Casa', tipo: 'deposito', activo: true }),
    ).rejects.toThrow(ConflictException);
  });

  it('eliminar() lanza NotFoundException cuando no existe', async () => {
    repository.eliminar.mockResolvedValue('no_encontrada');
    await expect(service.eliminar('empresa-1', 'ubi-x')).rejects.toThrow(NotFoundException);
  });

  it('eliminar() lanza ConflictException cuando tiene movimientos registrados', async () => {
    repository.eliminar.mockResolvedValue('tiene_movimientos');
    await expect(service.eliminar('empresa-1', 'ubi-1')).rejects.toThrow(ConflictException);
  });

  it('eliminar() no lanza cuando el repositorio confirma la baja', async () => {
    repository.eliminar.mockResolvedValue('ok');
    await expect(service.eliminar('empresa-1', 'ubi-1')).resolves.toBeUndefined();
  });

  it('crear() recorta la descripción vacía a null', async () => {
    repository.crear.mockResolvedValue({ ok: true, ubicacion: ubicacionBase });
    await service.crear('empresa-1', { nombre: 'Casa', descripcion: '   ', tipo: 'deposito', activo: true });
    expect(repository.crear).toHaveBeenCalledWith('empresa-1', {
      nombre: 'Casa',
      descripcion: null,
      tipo: 'deposito',
      activo: true,
    });
  });
});

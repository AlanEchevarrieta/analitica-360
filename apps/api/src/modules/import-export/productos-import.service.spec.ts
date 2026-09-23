import { Test } from '@nestjs/testing';
import { ProductosImportService } from './productos-import.service.js';
import { PRODUCTOS_IMPORT_REPOSITORY, type ProductosImportRepository } from './productos-import.repository.js';

describe('ProductosImportService', () => {
  let service: ProductosImportService;
  let repository: { [K in keyof ProductosImportRepository]: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    repository = { nombresExistentes: vi.fn(), crear: vi.fn() };
    const module = await Test.createTestingModule({
      providers: [ProductosImportService, { provide: PRODUCTOS_IMPORT_REPOSITORY, useValue: repository }],
    }).compile();
    service = module.get(ProductosImportService);
  });

  const matriz = [
    ['Nombre', 'Categoría', 'Precio de venta', 'Costo', 'Stock inicial'],
    ['Remera', 'Indumentaria', 15000, 8000, 10],
    ['Pantalón', 'Indumentaria', 20000, 12000, 5],
  ];

  it('salta filas cuyo nombre ya existe en la empresa (case-insensitive)', async () => {
    repository.nombresExistentes.mockResolvedValue(['remera']);
    repository.crear.mockResolvedValue({ ok: true });
    const res = await service.importar('empresa-1', 'usuario-1', matriz);
    expect(res.importados).toBe(1);
    expect(res.saltados).toEqual(['Remera']);
    expect(repository.crear).toHaveBeenCalledTimes(1);
    expect(repository.crear).toHaveBeenCalledWith('empresa-1', 'usuario-1', expect.objectContaining({ nombre: 'Pantalón' }));
  });

  it('salta duplicados DENTRO del mismo archivo (no solo contra lo ya existente)', async () => {
    repository.nombresExistentes.mockResolvedValue([]);
    repository.crear.mockResolvedValue({ ok: true });
    const matrizConDup = [
      ['Nombre', 'Categoría', 'Precio de venta', 'Costo', 'Stock inicial'],
      ['Remera', 'Indumentaria', 15000, 8000, 10],
      ['remera', 'Indumentaria', 15000, 8000, 10],
    ];
    const res = await service.importar('empresa-1', 'usuario-1', matrizConDup);
    expect(res.importados).toBe(1);
    expect(res.saltados).toEqual(['remera']);
  });

  it('agrega el motivo del error a saltados cuando la creación falla', async () => {
    repository.nombresExistentes.mockResolvedValue([]);
    repository.crear.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, motivo: 'Precio inválido' });
    const res = await service.importar('empresa-1', 'usuario-1', matriz);
    expect(res.importados).toBe(1);
    expect(res.saltados).toEqual(['Pantalón (Precio inválido)']);
  });
});

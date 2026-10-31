import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CajasService } from './cajas.service.js';

describe('CajasService - Control de Cajas, Turnos y Arqueo Cierre X/Z', () => {
  let service: CajasService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      cajaSesion: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
      },
      cajaMovimiento: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      venta: {
        findMany: vi.fn(),
      },
    };
    service = new CajasService(mockPrisma);
  });

  describe('Apertura de Caja', () => {
    it('debe rechazar la apertura si ya existe una caja abierta en la empresa', async () => {
      mockPrisma.cajaSesion.findFirst.mockResolvedValueOnce({
        id: 'caja-1',
        nombreCaja: 'Caja Principal',
        estado: 'abierta',
      });

      await expect(
        service.abrir('emp-1', 'usr-1', {
          montoInicial: 10000,
          nombreCaja: 'Caja Tarde',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe abrir un nuevo turno con fondo inicial si no hay cajas abiertas', async () => {
      mockPrisma.cajaSesion.findFirst.mockResolvedValueOnce(null);
      mockPrisma.cajaSesion.create.mockResolvedValueOnce({
        id: 'caja-2',
        empresaId: 'emp-1',
        usuarioAperturaId: 'usr-1',
        montoInicial: 15000,
        estado: 'abierta',
        nombreCaja: 'Caja Mañana',
      });

      const resultado = await service.abrir('emp-1', 'usr-1', {
        montoInicial: 15000,
        nombreCaja: 'Caja Mañana',
      });

      expect(resultado.id).toBe('caja-2');
      expect(resultado.estado).toBe('abierta');
      expect(resultado.montoInicial).toBe(15000);
    });
  });

  describe('Movimientos de Caja (Sangrías e Ingresos)', () => {
    it('debe rechazar un movimiento si la caja está cerrada o no existe', async () => {
      mockPrisma.cajaSesion.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.crearMovimiento('emp-1', 'usr-1', 'caja-inexistente', {
          tipo: 'egreso',
          monto: 3000,
          concepto: 'Pago a fletero',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe registrar un egreso (sangría) exitosamente', async () => {
      mockPrisma.cajaSesion.findFirst.mockResolvedValueOnce({
        id: 'caja-1',
        empresaId: 'emp-1',
        estado: 'abierta',
      });
      mockPrisma.cajaMovimiento.create.mockResolvedValueOnce({
        id: 'mov-1',
        tipo: 'egreso',
        monto: 5000,
        concepto: 'Retiro de seguridad',
        usuario: { id: 'usr-1', nombre: 'Juan Cajero' },
      });

      const res = await service.crearMovimiento('emp-1', 'usr-1', 'caja-1', {
        tipo: 'egreso',
        monto: 5000,
        concepto: 'Retiro de seguridad',
      });

      expect(res.tipo).toBe('egreso');
      expect(res.monto).toBe(5000);
      expect(res.usuario.nombre).toBe('Juan Cajero');
    });
  });

  describe('Arqueo Ciego y Cierre de Caja (Reporte Z)', () => {
    it('calcula faltante cuando el cajero declara menos del efectivo teórico esperado', async () => {
      // Fondo inicial: 10.000
      // Ventas en efectivo: 25.000
      // Sangrías (egresos): 5.000
      // Esperado: 10.000 + 25.000 - 5.000 = 30.000
      // Cajero cuenta: 28.500 -> Faltante de -1.500
      const fechaApertura = new Date('2026-10-31T08:00:00Z');
      const cajaMock = {
        id: 'caja-1',
        empresaId: 'emp-1',
        estado: 'abierta',
        montoInicial: 10000,
        nombreCaja: 'Caja 1',
        fechaApertura,
        usuarioApertura: { id: 'usr-1', nombre: 'Ana' },
        ubicacion: null,
        movimientos: [
          { tipo: 'egreso', monto: 5000, concepto: 'Sangría', usuario: { nombre: 'Ana' }, fecha: fechaApertura },
        ],
        empresa: { nombre: 'Panadería Central', configuracion: null },
      };

      mockPrisma.cajaSesion.findFirst.mockResolvedValueOnce(cajaMock);
      mockPrisma.venta.findMany.mockResolvedValueOnce([
        { id: 'v-1', formaPago: 'efectivo', totalConInteres: 25000 },
        { id: 'v-2', formaPago: 'debito', totalConInteres: 14000 },
      ]);

      mockPrisma.cajaSesion.update.mockImplementationOnce(({ data }: any) => ({
        ...cajaMock,
        ...data,
        usuarioCierre: { id: 'usr-1', nombre: 'Ana' },
        fechaCierre: new Date(),
      }));

      const reporteZ = await service.cerrar('emp-1', 'usr-1', 'caja-1', {
        montoDeclarado: 28500, // Arqueo ciego
      });

      expect(reporteZ.tipoReporte).toBe('Z');
      expect(reporteZ.montoInicial).toBe(10000);
      expect(reporteZ.totalVentasEfectivo).toBe(25000);
      expect(reporteZ.totalVentasDigital).toBe(14000);
      expect(reporteZ.totalEgresos).toBe(5000);
      expect(reporteZ.efectivoEsperado).toBe(30000);
      expect(reporteZ.montoDeclarado).toBe(28500);
      expect(reporteZ.diferencia).toBe(-1500); // Faltante
    });

    it('calcula sobrante cuando el cajero declara más del efectivo teórico esperado', async () => {
      const fechaApertura = new Date('2026-10-31T08:00:00Z');
      const cajaMock = {
        id: 'caja-2',
        empresaId: 'emp-1',
        estado: 'abierta',
        montoInicial: 5000,
        nombreCaja: 'Caja 2',
        fechaApertura,
        usuarioApertura: { id: 'usr-1', nombre: 'Pedro' },
        ubicacion: null,
        movimientos: [],
        empresa: { nombre: 'Comercio Test', configuracion: null },
      };

      mockPrisma.cajaSesion.findFirst.mockResolvedValueOnce(cajaMock);
      mockPrisma.venta.findMany.mockResolvedValueOnce([
        { id: 'v-1', formaPago: 'efectivo', totalConInteres: 10000 },
      ]);

      mockPrisma.cajaSesion.update.mockImplementationOnce(({ data }: any) => ({
        ...cajaMock,
        ...data,
        usuarioCierre: { id: 'usr-1', nombre: 'Pedro' },
        fechaCierre: new Date(),
      }));

      // Esperado: 5.000 + 10.000 = 15.000
      // Declara: 15.800 -> Sobrante de 800
      const reporteZ = await service.cerrar('emp-1', 'usr-1', 'caja-2', {
        montoDeclarado: 15800,
      });

      expect(reporteZ.efectivoEsperado).toBe(15000);
      expect(reporteZ.montoDeclarado).toBe(15800);
      expect(reporteZ.diferencia).toBe(800); // Sobrante
    });
  });

  describe('Reporte X (Corte Parcial en Tiempo Real)', () => {
    it('genera el corte parcial sin alterar el estado de la caja', async () => {
      const fechaApertura = new Date('2026-10-31T09:00:00Z');
      const cajaMock = {
        id: 'caja-3',
        empresaId: 'emp-1',
        estado: 'abierta',
        montoInicial: 8000,
        nombreCaja: 'Caja Principal',
        fechaApertura,
        usuarioApertura: { id: 'usr-2', nombre: 'Carlos' },
        ubicacion: null,
        movimientos: [
          { tipo: 'ingreso', monto: 2000, concepto: 'Cambio extra traído', usuario: { nombre: 'Carlos' }, fecha: fechaApertura },
        ],
        empresa: { nombre: 'Supermercado Sol', configuracion: null },
      };

      mockPrisma.cajaSesion.findFirst.mockResolvedValueOnce(cajaMock);
      mockPrisma.venta.findMany.mockResolvedValueOnce([
        { id: 'v-10', formaPago: 'efectivo', totalConInteres: 12000 },
        { id: 'v-11', formaPago: 'qr', totalConInteres: 8500 },
      ]);

      const reporteX = await service.reporteX('emp-1', 'caja-3');

      expect(reporteX.tipoReporte).toBe('X');
      expect(reporteX.estado).toBe('abierta');
      expect(reporteX.efectivoEsperado).toBe(22000); // 8.000 + 12.000 + 2.000
      expect(reporteX.totalVentas).toBe(20500); // 12.000 + 8.500
      expect(reporteX.cantidadVentas).toBe(2);
    });
  });
});

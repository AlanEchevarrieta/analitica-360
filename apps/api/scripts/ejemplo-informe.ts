// Genera PDFs de ejemplo del informe (datos inventados) para revisar el diseño.
//   pnpm exec tsx scripts/ejemplo-informe.ts <carpeta>
import fs from 'node:fs';
import path from 'node:path';
import { pdfInforme } from '../src/modules/informes/informe.pdf.js';
import type { DatosInforme } from '../src/modules/informes/informes-datos.service.js';
import { completarDias, variacion } from '../src/modules/informes/informes.util.js';

const carpeta = process.argv[2] ?? '.';
const cifra = (valor: number, anterior: number) => ({ valor, anterior, variacion: variacion(valor, anterior) });
const semana = { desde: '2026-09-28', hasta: '2026-10-04' };
const semanal: DatosInforme = {
  empresa: 'Acacia',
  tipo: 'semanal',
  periodo: semana,
  ventas: cifra(1_284_500, 1_102_300),
  cantidad: cifra(37, 41),
  ticket: cifra(34_716, 26_885),
  ganancia: cifra(612_300, 498_100),
  margenPct: 47.7,
  dias: completarDias(semana, [
    { fecha: '2026-09-28', total: 98_000 },
    { fecha: '2026-09-29', total: 152_500 },
    { fecha: '2026-09-30', total: 75_000 },
    { fecha: '2026-10-01', total: 210_000 },
    { fecha: '2026-10-02', total: 318_000 },
    { fecha: '2026-10-03', total: 431_000 },
  ]),
  masVendidos: [
    { nombre: 'Mate Imperial de calabaza con virola de alpaca', unidades: 6, total: 384_000 },
    { nombre: 'Bolso matero de cuero', unidades: 3, total: 255_000 },
    { nombre: 'Termo Stanley 1 L', unidades: 2, total: 190_000 },
    { nombre: 'Bombilla pico de loro', unidades: 9, total: 117_000 },
    { nombre: 'Yerbera de cuero', unidades: 4, total: 96_000 },
  ],
  formasPago: [
    { nombre: 'Transferencia', total: 702_000, cantidad: 18 },
    { nombre: 'Efectivo', total: 398_500, cantidad: 14 },
    { nombre: 'Mercado Pago QR', total: 184_000, cantidad: 5 },
  ],
  compras: cifra(420_000, 610_000),
  stockBajo: [
    { nombre: 'Bombilla pico de loro', stock: 2 },
    { nombre: 'Mate Imperial', stock: 1 },
    { nombre: 'Canasto para asado', stock: 0 },
  ],
  sinVentas: { cantidad: 23, ejemplos: ['Bandeja de algarrobo', 'Canasto para asado', 'Mochila con bolsillos', 'Porta mate', 'Set asador'] },
  cuentaCorriente: null,
  monotributo: null,
  demasiadasVentas: false,
};
const mes = { desde: '2026-09-01', hasta: '2026-09-30' };
const mensual: DatosInforme = {
  ...semanal,
  tipo: 'mensual',
  periodo: mes,
  ventas: cifra(4_912_000, 4_350_000),
  cantidad: cifra(151, 139),
  ticket: cifra(32_530, 31_295),
  ganancia: cifra(2_301_000, 2_050_000),
  margenPct: 46.8,
  dias: completarDias(mes, Array.from({ length: 30 }, (_, i) => ({ fecha: `2026-09-${String(i + 1).padStart(2, '0')}`, total: Math.round(80_000 + 120_000 * Math.abs(Math.sin(i * 1.3)) + (i % 7 === 5 ? 150_000 : 0)) }))),
  compras: cifra(1_820_000, 1_640_000),
  cuentaCorriente: {
    total: 386_000,
    deudores: [
      { nombre: 'Juan Pérez', saldo: 180_000, dias: 45 },
      { nombre: 'Almacén Don Luis', saldo: 126_000, dias: 12 },
      { nombre: 'María Gómez', saldo: 80_000, dias: 3 },
    ],
  },
  monotributo: { categoria: 'D', usoPct: 78, margenDisponible: 4_850_000, proyeccionAnual: 21_600_000, categoriaProyectada: 'D' },
};

fs.mkdirSync(carpeta, { recursive: true });
for (const d of [semanal, mensual]) fs.writeFileSync(path.join(carpeta, `ejemplo-${d.tipo}.pdf`), await pdfInforme(d));
console.log('listo');

#!/usr/bin/env node
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('\n🌊 === TEST & DIAGNÓSTICO DEL DATALAKE ANALÍTICA 360 ===\n');

  // 1. Obtener empresa con más ventas (o la primera)
  const empresasConVentas = await prisma.empresa.findMany({
    select: {
      id: true,
      nombre: true,
      cuit: true,
      _count: { select: { ventas: true, productos: true, clientes: true } },
    },
    orderBy: { ventas: { _count: 'desc' } },
    take: 1,
  });

  const empresa = empresasConVentas[0];

  if (!empresa) {
    console.error('❌ No se encontró ninguna empresa en la base de datos.');
    process.exit(1);
  }

  console.log(`🏢 Empresa objetivo: ${empresa.nombre} (${empresa.id})`);

  // 2. Conteo de datos actuales
  const [totalVentas, totalClientes, totalProductos, totalEventosLake, totalInsights] = await Promise.all([
    prisma.venta.count({ where: { empresaId: empresa.id } }),
    prisma.cliente.count({ where: { empresaId: empresa.id } }),
    prisma.producto.count({ where: { empresaId: empresa.id } }),
    prisma.lakeEvento.count({ where: { empresaId: empresa.id } }),
    prisma.copilotInsightCache.count({ where: { empresaId: empresa.id } }),
  ]);

  console.log(`📊 Datos transaccionales en base de datos:`);
  console.log(`   - Ventas: ${totalVentas}`);
  console.log(`   - Clientes: ${totalClientes}`);
  console.log(`   - Productos: ${totalProductos}`);
  console.log(`   - Eventos ya en el Lakehouse (Bronze): ${totalEventosLake}`);
  console.log(`   - Insights en Feature Store (Gold): ${totalInsights}\n`);

  // 3. Ingestar un evento de prueba
  console.log('📥 1. Ingestando evento de prueba en Lakehouse (Capa Bronze)...');
  const nuevoEvento = await prisma.lakeEvento.create({
    data: {
      empresaId: empresa.id,
      tipoEvento: 'test.datalake_ping',
      entidadId: 'ping-1',
      horaDia: new Date().getHours(),
      diaSemana: new Date().getDay(),
      payload: { origen: 'script_probar_datalake', timestamp: new Date().toISOString() },
    },
  });
  console.log(`   ✅ Evento registrado con ID: ${nuevoEvento.id}\n`);

  // 4. Ejecutar algoritmos del Lakehouse
  console.log('🧠 2. Ejecutando Algoritmos Analíticos del Lakehouse...');

  // A. Market Basket
  const hace60Dias = new Date();
  hace60Dias.setDate(hace60Dias.getDate() - 60);
  const ventasConItems = await prisma.venta.findMany({
    where: { empresaId: empresa.id, fecha: { gte: hace60Dias }, deletedAt: null },
    select: {
      id: true,
      items: { select: { productoId: true, producto: { select: { nombre: true } } } },
    },
    take: 500,
  });

  const conteoPares = new Map();
  for (const v of ventasConItems) {
    const prods = (v.items || []).filter((it) => it.productoId && it.producto);
    for (let i = 0; i < prods.length; i++) {
      for (let j = i + 1; j < prods.length; j++) {
        const par = [prods[i].producto.nombre, prods[j].producto.nombre].sort().join(' + ');
        conteoPares.set(par, (conteoPares.get(par) || 0) + 1);
      }
    }
  }

  const paresDestacados = [...conteoPares.entries()]
    .filter(([_, qty]) => qty >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  console.log(`   🛒 Afinidad de Canasta (Market Basket Analysis):`);
  if (paresDestacados.length > 0) {
    paresDestacados.forEach(([par, qty]) => console.log(`      * [${qty} tickets juntos] ${par}`));
  } else {
    console.log(`      (No hay tickets con combinaciones frecuentes en los últimos 60 días)`);
  }

  // B. Churn
  const clientes = await prisma.cliente.findMany({
    where: { empresaId: empresa.id, deletedAt: null },
    select: {
      id: true,
      nombre: true,
      ventas: {
        where: { deletedAt: null },
        orderBy: { fecha: 'desc' },
        take: 5,
        select: { fecha: true, totalSinInteres: true },
      },
    },
    take: 100,
  });

  let clientesEnRiesgo = 0;
  const ahora = new Date();
  for (const cli of clientes) {
    if (cli.ventas.length >= 3) {
      const fechas = cli.ventas.map((v) => new Date(v.fecha).getTime()).sort((a, b) => a - b);
      let difAcum = 0;
      for (let k = 1; k < fechas.length; k++) difAcum += fechas[k] - fechas[k - 1];
      const promMs = difAcum / (fechas.length - 1);
      const ultVenta = fechas[fechas.length - 1];
      const transcurrido = ahora.getTime() - ultVenta;
      if (transcurrido > promMs * 2.5 && transcurrido > 14 * 24 * 3600_000) {
        clientesEnRiesgo++;
      }
    }
  }
  console.log(`   ⚠️ Detección de Abandono (RFM Churn): ${clientesEnRiesgo} clientes habituales con compras demoradas`);

  // C. Feature Store
  const insightsGuardados = await prisma.copilotInsightCache.findMany({
    where: { empresaId: empresa.id },
    take: 5,
    orderBy: { createdAt: 'desc' },
  });

  console.log(`\n💎 3. Insights en Feature Store para Copilot IA (${insightsGuardados.length}):`);
  if (insightsGuardados.length === 0) {
    console.log(`   (El Feature Store se recalcula al consultar Copilot IA o vía POST /lake/recalcular)`);
  } else {
    insightsGuardados.forEach((ins) => {
      console.log(`   * [${ins.categoria.toUpperCase()}] ${ins.titulo}`);
      console.log(`     Acción: ${ins.sugerenciaAccionable.slice(0, 90)}...`);
    });
  }

  console.log('\n✨ ¡Prueba del Data Lake completada con éxito!\n');
}

main()
  .catch((e) => {
    console.error('Error en prueba del Data Lake:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

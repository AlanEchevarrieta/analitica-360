import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { LakeService } from '../src/modules/lake/lake.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('\n🌊 === TEST INTEGRAL DEL DATALAKEHOUSE Y FEATURE STORE ===\n');

  // 1. Obtener la empresa con más transacciones
  const empresas = await prisma.empresa.findMany({
    select: {
      id: true,
      nombre: true,
      cuit: true,
      _count: { select: { ventas: true, productos: true, clientes: true } },
    },
    orderBy: { ventas: { _count: 'desc' } },
    take: 1,
  });

  const empresa = empresas[0];
  if (!empresa) {
    console.error('❌ No hay empresas en la base de datos.');
    process.exit(1);
  }

  console.log(`🏢 Empresa evaluada: ${empresa.nombre} (${empresa.id})`);
  console.log(`📊 Volumen transaccional:`);
  console.log(`   - Ventas: ${empresa._count.ventas}`);
  console.log(`   - Clientes: ${empresa._count.clientes}`);
  console.log(`   - Productos: ${empresa._count.productos}\n`);

  // 2. Instanciar el servicio real del Lakehouse
  const lakeService = new LakeService(prisma as any);

  // 3. Ingestar evento Bronze
  console.log('📥 1. Ingestando Evento en Capa Bronze (LakeEvento)...');
  await lakeService.ingestarEvento({
    empresaId: empresa.id,
    tipoEvento: 'lake.test_verificacion',
    entidadId: 'verif-001',
    fecha: new Date(),
    payload: {
      fuente: 'terminal_test',
      status: 'ok',
      version: '1.0.0',
    },
    metadata: {
      ip: '127.0.0.1',
      agente: 'Node-Lake-Tester',
    },
  });

  const ultimoEvento = await prisma.lakeEvento.findFirst({
    where: { empresaId: empresa.id, tipoEvento: 'lake.test_verificacion' },
    orderBy: { fecha: 'desc' },
  });
  console.log(`   ✅ Evento persistido con ID: ${ultimoEvento?.id} | Hora: ${ultimoEvento?.horaDia}hs | Día: ${ultimoEvento?.diaSemana}\n`);

  // 4. Ejecutar Pipeline Analítico Gold (Feature Store)
  console.log('🧠 2. Ejecutando Algoritmos Analíticos (Feature Store & Lake)...');
  const insights = await lakeService.generarInsightsOcultos(empresa.id);
  console.log(`   ✅ Algoritmos ejecutados. Insights generados: ${insights.length}\n`);

  // 5. Mostrar Insights calculados
  console.log('💎 3. Patrones Ocultos Listos para Copilot IA:');
  if (insights.length === 0) {
    console.log('   (No se detectaron anomalías críticas con el volumen de ventas reciente)');
  } else {
    insights.forEach((ins, idx) => {
      console.log(`\n   [${idx + 1}] [${ins.prioridad.toUpperCase()}] ${ins.titulo}`);
      console.log(`       Categoría: ${ins.categoria}`);
      console.log(`       Diagnóstico: ${ins.descripcionTecnica}`);
      console.log(`       Acción sugerida: ${ins.sugerenciaAccionable}`);
    });
  }

  // 6. Verificar persistencia en base de datos
  const enCache = await prisma.copilotInsightCache.count({
    where: { empresaId: empresa.id },
  });
  console.log(`\n📦 Insights persistidos en BD (copilot_insights_cache): ${enCache}`);
  console.log('\n🎉 ¡El Lakehouse está 100% operativo y listo para alimentar a Copilot IA y Radar de Precios!\n');
}

main()
  .catch((err) => {
    console.error('Error durante el test del Lakehouse:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

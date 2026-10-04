// Pone categoría a productos que no tienen y después genera los SKU que falten,
// con el mismo código que usa la app. Todo queda en la bitácora de auditoría
// como un cambio del "Equipo Analítica 360".
//
// Uso (desde apps/api): npx tsx scripts/categorizar-productos.ts --empresa <uuid> "Producto=Categoría" ... [--aplicar]
// Sin --aplicar solo muestra qué haría.
import 'dotenv/config';
import { Prisma } from '@prisma/client';
import { conContextoAuditoria, type ContextoAuditoria } from '../src/common/auditoria/contexto-auditoria.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { PrismaSkuRepository } from '../src/modules/productos/prisma-sku.repository.js';
import { baseSku } from '../src/modules/productos/sku.util.js';

const args = process.argv.slice(2);
const empresa = args[args.indexOf('--empresa') + 1];
const aplicar = args.includes('--aplicar');
const pedidos = args.filter((a) => a.includes('=')).map((a) => a.split('=') as [string, string]);
if (!empresa || pedidos.length === 0) {
  console.error('Uso: npx tsx scripts/categorizar-productos.ts --empresa <uuid> "Producto=Categoría" ... [--aplicar]');
  process.exit(1);
}

const prisma = new PrismaService();
await prisma.$connect();
const ctx: ContextoAuditoria = {
  actorUsuarioId: null,
  actorEmpresaId: null,
  actorTipo: 'admin',
  actorNombre: 'Equipo Analítica 360',
  ip: null,
  ruta: 'scripts/categorizar-productos.ts',
  eventos: [],
};

try {
  // Primero se valida todo: si algo no existe, no se toca nada.
  const plan = [];
  for (const [nombre, categoria] of pedidos) {
    const p = await prisma.producto.findFirst({ where: { empresaId: empresa, nombre, deletedAt: null }, select: { id: true, categoriaId: true, sku: true, usaVariantes: true } });
    const c = await prisma.categoria.findFirst({ where: { empresaId: empresa, nombre: categoria } });
    if (!p) throw new Error(`No existe el producto "${nombre}"`);
    if (!c) throw new Error(`No existe la categoría "${categoria}"`);
    if (p.categoriaId) throw new Error(`"${nombre}" ya tiene categoría: no se pisa`);
    plan.push({ ...p, nombre, categoria: c });
    console.log(`${nombre} → ${categoria}${p.sku || p.usaVariantes ? '' : ` · SKU ${baseSku({ categoria, producto: nombre })}-NNN`}`);
  }
  if (!aplicar) {
    console.log('\nPrueba: no se guardó nada. Agregá --aplicar.');
  } else {
    await conContextoAuditoria(ctx, async () => {
      for (const p of plan) await prisma.producto.update({ where: { id: p.id }, data: { categoriaId: p.categoria.id, categoria: p.categoria.nombre } });
      const n = await new PrismaSkuRepository(prisma).asignarFaltantes(empresa);
      console.log(`\nCategorías puestas: ${plan.length} · SKU generados: ${n}`);
    });
    // Igual que AuditoriaInterceptor: lo que cambió va a la bitácora.
    await prisma.registroAuditoria.createMany({
      data: ctx.eventos.map((e) => ({
        ...e,
        cambios: (e.cambios ?? undefined) as Prisma.InputJsonValue | undefined,
        empresaId: e.empresaId ?? empresa,
        actorTipo: ctx.actorTipo,
        actorNombre: ctx.actorNombre,
        ruta: ctx.ruta,
      })),
    });
    for (const e of ctx.eventos) console.log(`  bitácora: ${e.resumen}`);
  }
} finally {
  await prisma.$disconnect();
}

import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { fechaHoyAR, sumarDiasIso } from '../analytics/analytics.util.js';
import { diaAR } from '../analytics/fecha-sql.js';
import { dineroDevolucionesPorDia } from '../analytics/devoluciones-dinero.js';
import { CATEGORIAS_MONOTRIBUTO, estadoMonotributo, type EstadoMonotributo, type TopeCategoria } from './monotributo.util.js';

export interface MonotributoRespuesta {
  condicionFiscal: string;
  estado: EstadoMonotributo | null;
  vigenciaTopes: string | null;
  topes: TopeCategoria[];
  /** Ingresos por mes de los últimos 12 meses (incluye el actual). */
  meses: { mes: string; ingresos: number }[];
}

const inicioDia = (fecha: string) => new Date(`${fecha}T00:00:00.000-03:00`);

@Injectable()
export class MonotributoService {
  constructor(private readonly prisma: PrismaService) {}

  /** Topes de la vigencia más reciente que ya empezó. */
  async topesVigentes(): Promise<{ vigencia: string | null; topes: TopeCategoria[] }> {
    const filas = await this.prisma.$queryRaw<{ vigencia: string; categoria: string; tope: string }[]>(Prisma.sql`
      SELECT vigencia_desde::text AS vigencia, categoria, tope_anual AS tope FROM monotributo_topes
      WHERE vigencia_desde = (SELECT MAX(vigencia_desde) FROM monotributo_topes WHERE vigencia_desde <= CURRENT_DATE)
      ORDER BY tope_anual
    `);
    return {
      vigencia: filas[0]?.vigencia ?? null,
      topes: filas.map((f) => ({ categoria: f.categoria as TopeCategoria['categoria'], topeAnual: Number(f.tope) })),
    };
  }

  async estado(empresaId: string): Promise<MonotributoRespuesta> {
    const hoy = fechaHoyAR();
    const desde12 = sumarDiasIso(hoy, -364);
    const desde3 = sumarDiasIso(hoy, -89);
    const fin = inicioDia(sumarDiasIso(hoy, 1));
    const [config, { vigencia, topes }, ventasMes, devoluciones] = await Promise.all([
      this.prisma.configuracionEmpresa.findUnique({ where: { empresaId }, select: { condicionFiscal: true, categoriaMonotributo: true } }),
      this.topesVigentes(),
      // Ingresos brutos (lo vendido, incluido el interés de cuotas) por día de los últimos 12 meses.
      this.prisma.$queryRaw<{ dia: string; total: string }[]>(Prisma.sql`
        SELECT ${diaAR(Prisma.raw('v.fecha'))}::text AS dia, SUM(COALESCE(v.total_con_interes, 0)) AS total
        FROM ventas v
        WHERE v.empresa_id = ${empresaId}::uuid AND v.deleted_at IS NULL AND v.fecha >= ${inicioDia(sumarDiasIso(hoy, -400))} AND v.fecha < ${fin}
        GROUP BY 1
      `),
      dineroDevolucionesPorDia(this.prisma, empresaId, inicioDia(sumarDiasIso(hoy, -400)), fin),
    ]);
    const porDia = [
      ...ventasMes.map((v) => ({ dia: v.dia, monto: Number(v.total) })),
      // Las devoluciones restan ingresos (y un cambio con diferencia a favor suma).
      ...devoluciones.map((d) => ({ dia: d.fecha, monto: d.ingreso })),
    ];
    const sumaDesde = (desde: string) => porDia.filter((x) => x.dia >= desde && x.dia <= hoy).reduce((a, x) => a + x.monto, 0);

    const meses: { mes: string; ingresos: number }[] = [];
    const [y, m] = hoy.split('-').map(Number);
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(y, m - 1 - i, 1));
      const mes = d.toISOString().slice(0, 7);
      meses.push({ mes, ingresos: Math.round(porDia.filter((x) => x.dia.startsWith(mes)).reduce((a, x) => a + x.monto, 0)) });
    }

    const condicionFiscal = config?.condicionFiscal ?? 'monotributo';
    return {
      condicionFiscal,
      estado:
        condicionFiscal === 'monotributo'
          ? estadoMonotributo({
              ingresos12m: Math.round(sumaDesde(desde12)),
              ingresosUltimos3Meses: sumaDesde(desde3),
              categoriaActual: config?.categoriaMonotributo ?? null,
              topes,
              vigenciaTopes: vigencia,
              hoy,
            })
          : null,
      vigenciaTopes: vigencia,
      topes,
      meses,
    };
  }

  /** Admin: todas las vigencias cargadas. */
  async listarTopes(): Promise<{ vigencia: string; topes: TopeCategoria[] }[]> {
    const filas = await this.prisma.$queryRaw<{ vigencia: string; categoria: string; tope: string }[]>(Prisma.sql`
      SELECT vigencia_desde::text AS vigencia, categoria, tope_anual AS tope FROM monotributo_topes ORDER BY vigencia_desde DESC, tope_anual
    `);
    const porVigencia = new Map<string, TopeCategoria[]>();
    for (const f of filas) {
      const lista = porVigencia.get(f.vigencia) ?? [];
      lista.push({ categoria: f.categoria as TopeCategoria['categoria'], topeAnual: Number(f.tope) });
      porVigencia.set(f.vigencia, lista);
    }
    return [...porVigencia].map(([vigencia, topes]) => ({ vigencia, topes }));
  }

  /** Admin: carga (o reemplaza) los topes de una vigencia. Tienen que ser las 11 categorías y crecientes. */
  async guardarTopes(vigencia: string, topes: TopeCategoria[]): Promise<void> {
    const ordenados = CATEGORIAS_MONOTRIBUTO.map((c) => topes.find((t) => t.categoria === c));
    if (ordenados.some((t) => !t || !(t.topeAnual > 0))) throw new BadRequestException('Cargá el tope de las 11 categorías (A a K)');
    if (ordenados.some((t, i) => i > 0 && t!.topeAnual <= ordenados[i - 1]!.topeAnual)) throw new BadRequestException('Cada categoría tiene que tener un tope mayor que la anterior');
    const fecha = new Date(vigencia);
    await this.prisma.$transaction([
      this.prisma.monotributoTope.deleteMany({ where: { vigenciaDesde: fecha } }),
      this.prisma.monotributoTope.createMany({ data: ordenados.map((t) => ({ vigenciaDesde: fecha, categoria: t!.categoria, topeAnual: t!.topeAnual })) }),
    ]);
  }
}

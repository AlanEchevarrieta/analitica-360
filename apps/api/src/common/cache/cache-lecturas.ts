import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { finalize, from, lastValueFrom, type Observable } from 'rxjs';

export const CACHE_LECTURA_KEY = 'cacheLectura';
/**
 * Reportes pesados (Inicio, Analytics, Contabilidad): la respuesta se guarda en memoria
 * por empresa hasta que esa empresa escriba algo (ver CacheLecturasInterceptor).
 */
export const CacheLectura = () => SetMetadata(CACHE_LECTURA_KEY, true);

/** Tope de seguridad: aunque nadie escriba, a los 5 minutos se recalcula ("hoy" cambia, la cotización también). */
const VIDA_MS = 5 * 60_000;
const MAX_ENTRADAS = 300;
const LECTURAS = new Set(['GET', 'HEAD', 'OPTIONS']);

interface Entrada {
  version: string;
  vence: number;
  valor: Promise<unknown>;
}

/**
 * Cache en memoria de lecturas por empresa. Cada empresa tiene una "versión" que
 * sube con cada escritura suya; una escritura sin empresa (tienda pública,
 * consola, webhooks, tareas) sube la versión de todas. Así nunca se sirve un
 * dato viejo después de un cambio hecho en esta instancia. Pedidos iguales que
 * llegan a la vez comparten el mismo cálculo.
 *
 * Con varias instancias, otra instancia puede mostrar un reporte de hasta
 * VIDA_MS de antigüedad: si se escala horizontalmente, pasar las versiones a
 * la base o a Redis.
 */
@Injectable()
export class CacheLecturasService {
  private global = 0;
  private readonly versiones = new Map<string, number>();
  private readonly entradas = new Map<string, Entrada>();

  /** Apagada en las pruebas (escriben directo en la base), salvo que la pidan con CACHE_LECTURAS=1. */
  get activa() {
    return !process.env.VITEST || process.env.CACHE_LECTURAS === '1';
  }

  version(empresaId: string): string {
    return `${this.global}.${this.versiones.get(empresaId) ?? 0}`;
  }

  invalidar(empresaId?: string | null) {
    if (!empresaId) {
      this.global++;
      this.entradas.clear();
      return;
    }
    this.versiones.set(empresaId, (this.versiones.get(empresaId) ?? 0) + 1);
  }

  obtener<T>(empresaId: string, clave: string, calcular: () => Promise<T>): Promise<T> {
    if (!this.activa) return calcular();
    const k = `${empresaId}|${clave}`;
    const version = this.version(empresaId);
    const e = this.entradas.get(k);
    if (e && e.version === version && e.vence > Date.now()) {
      // Más usada: al final (la primera es la que se descarta cuando hay demasiadas).
      this.entradas.delete(k);
      this.entradas.set(k, e);
      return e.valor as Promise<T>;
    }
    const valor = calcular();
    this.entradas.set(k, { version, vence: Date.now() + VIDA_MS, valor });
    // Un error no queda guardado; un resultado que terminó después de una escritura, tampoco.
    valor.then(
      () => {
        if (this.version(empresaId) !== version) this.borrarSiEs(k, valor);
      },
      () => this.borrarSiEs(k, valor),
    );
    while (this.entradas.size > MAX_ENTRADAS) this.entradas.delete(this.entradas.keys().next().value!);
    return valor;
  }

  private borrarSiEs(k: string, valor: Promise<unknown>) {
    if (this.entradas.get(k)?.valor === valor) this.entradas.delete(k);
  }
}

@Injectable()
export class CacheLecturasInterceptor implements NestInterceptor {
  constructor(
    private readonly cache: CacheLecturasService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<Request>();
    const empresaId = req.empresa?.id ?? null;
    if (!LECTURAS.has(req.method)) {
      // La consola toca datos de todos (ej. topes del monotributo): invalida todo.
      if (req.path.startsWith('/admin')) {
        this.cache.invalidar(null);
        return next.handle().pipe(finalize(() => this.cache.invalidar(null)));
      }
      // Antes y después: una lectura que empezó en el medio tampoco queda guardada.
      this.cache.invalidar(empresaId);
      return next.handle().pipe(finalize(() => this.cache.invalidar(empresaId)));
    }
    if (!empresaId || !this.reflector.getAllAndOverride<boolean>(CACHE_LECTURA_KEY, [context.getHandler(), context.getClass()])) return next.handle();
    // El rol entra en la clave por si una respuesta depende de los permisos.
    const clave = `${req.usuario?.rol ?? ''}|${req.originalUrl}`;
    return from(this.cache.obtener(empresaId, clave, () => lastValueFrom(next.handle())));
  }
}

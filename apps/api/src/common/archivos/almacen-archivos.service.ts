import { randomUUID } from 'node:crypto';
import { mkdir, rm, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.validation.js';

/**
 * Dónde se guardan los archivos públicos (fotos de productos, logos).
 * Hoy: carpeta local servida por la API en /archivos (desarrollo). Al publicar
 * se agrega otro destino (Vercel Blob / Cloudinary) detrás de esta misma clase.
 */
@Injectable()
export class AlmacenArchivosService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  static carpetaLocal(dir?: string) {
    return resolve(dir || join(process.cwd(), 'uploads'));
  }

  private urlPublica() {
    return (this.config.get('ARCHIVOS_URL_PUBLICA', { infer: true }) || `http://localhost:${this.config.get('PORT', { infer: true })}/archivos`).replace(/\/+$/, '');
  }

  /** Guarda el archivo y devuelve su URL pública y la clave para borrarlo. */
  async guardar(empresaId: string, contenido: Buffer, extension: string): Promise<{ url: string; clave: string }> {
    const clave = `${empresaId}/${randomUUID()}.${extension}`;
    const carpeta = AlmacenArchivosService.carpetaLocal(this.config.get('ARCHIVOS_DIR', { infer: true }));
    await mkdir(join(carpeta, empresaId), { recursive: true });
    await writeFile(join(carpeta, clave), contenido);
    return { url: `${this.urlPublica()}/${clave}`, clave };
  }

  async borrar(clave: string): Promise<void> {
    // La clave la genera el sistema (empresa/uuid.ext): nunca rutas con "..".
    if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(clave)) return;
    const carpeta = AlmacenArchivosService.carpetaLocal(this.config.get('ARCHIVOS_DIR', { infer: true }));
    await unlink(join(carpeta, clave)).catch(() => {});
  }

  /** Borra todas las fotos y logos de una empresa (baja de la cuenta). */
  async borrarEmpresa(empresaId: string): Promise<void> {
    if (!/^[0-9a-f-]{36}$/.test(empresaId)) return;
    const carpeta = AlmacenArchivosService.carpetaLocal(this.config.get('ARCHIVOS_DIR', { infer: true }));
    await rm(join(carpeta, empresaId), { recursive: true, force: true });
  }
}

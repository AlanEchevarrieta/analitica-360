import sharp from 'sharp';

/** Tamaños máximos (lado mayor, en px) según dónde se muestra cada imagen. */
export const TAMANOS = {
  fotoGrande: 1600,
  fotoMiniatura: 640,
  logo: 512,
  portada: 2000,
} as const;

/**
 * Deja la imagen lista para la web: la gira según cómo se sacó, la achica si
 * hace falta, le saca los metadatos (incluida la ubicación GPS de las fotos
 * del celular) y la pasa a WEBP, que pesa mucho menos que JPG o PNG.
 */
export async function optimizarImagen(buffer: Buffer, ladoMaximo: number, calidad = 80): Promise<Buffer> {
  return sharp(buffer, { failOn: 'error' })
    .rotate()
    .resize({ width: ladoMaximo, height: ladoMaximo, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: calidad })
    .toBuffer();
}

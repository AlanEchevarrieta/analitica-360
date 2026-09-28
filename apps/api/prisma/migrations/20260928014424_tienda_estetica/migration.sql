-- AlterTable
ALTER TABLE "tiendas_config" ADD COLUMN     "anuncio" TEXT,
ADD COLUMN     "bordes" TEXT NOT NULL DEFAULT 'redondeados',
ADD COLUMN     "fondo" TEXT NOT NULL DEFAULT 'puntos',
ADD COLUMN     "portada_url" TEXT,
ADD COLUMN     "tipografia" TEXT NOT NULL DEFAULT 'clasica';

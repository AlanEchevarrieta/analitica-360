-- AlterTable
ALTER TABLE "productos_imagenes" ADD COLUMN     "clave_miniatura" TEXT,
ADD COLUMN     "url_miniatura" TEXT;

-- AlterTable
ALTER TABLE "tiendas_config" ADD COLUMN     "columnas_celular" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "facebook" TEXT,
ADD COLUMN     "forma_foto" TEXT NOT NULL DEFAULT 'horizontal',
ADD COLUMN     "horario" TEXT,
ADD COLUMN     "pedido_minimo" DECIMAL(12,2),
ADD COLUMN     "secciones_ocultas" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "sobre_nosotros" TEXT,
ADD COLUMN     "tiktok" TEXT,
ADD COLUMN     "titulo_destacados" TEXT;

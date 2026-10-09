-- Factura C por email: a quién y cuándo se mandó por última vez.
-- AlterTable
ALTER TABLE "comprobantes" ADD COLUMN     "email_enviado_a" TEXT,
ADD COLUMN     "email_enviado_en" TIMESTAMP(3);


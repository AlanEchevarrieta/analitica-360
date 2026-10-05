-- AlterTable
ALTER TABLE "empresas" ADD COLUMN     "precio_especial_mensual" DECIMAL(12,2),
ADD COLUMN     "precio_especial_nota" VARCHAR(200),
ADD COLUMN     "precio_especial_plan" VARCHAR(20);


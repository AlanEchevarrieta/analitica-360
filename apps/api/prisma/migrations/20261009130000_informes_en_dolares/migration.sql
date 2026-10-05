-- Informes por email: mostrar también los números en dólares.
ALTER TABLE "informes_config" ADD COLUMN "con_dolares" BOOLEAN NOT NULL DEFAULT false;

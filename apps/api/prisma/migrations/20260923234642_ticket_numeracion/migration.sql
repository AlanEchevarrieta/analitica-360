-- CreateTable
CREATE TABLE "tickets_numeracion" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "ultimo" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "tickets_numeracion_pkey" PRIMARY KEY ("id")
);

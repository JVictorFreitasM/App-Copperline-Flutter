-- CreateEnum
CREATE TYPE "tipo_produto" AS ENUM ('INVALIDO', 'CLASSE', 'PROPRIO', 'TERCEIROS', 'KIT');

-- AlterTable
ALTER TABLE "sync_logs" ADD COLUMN     "avisos" JSONB;

-- CreateTable
CREATE TABLE "produtos" (
    "id" TEXT NOT NULL,
    "id_externo_erp" TEXT NOT NULL,
    "codigo_integrador" TEXT,
    "codigo" TEXT,
    "nome" TEXT,
    "descricao" TEXT,
    "tipo" "tipo_produto",
    "inativo" BOOLEAN NOT NULL DEFAULT false,
    "preco_venda" DECIMAL(18,6),
    "gtin" TEXT,
    "id_grade_1" TEXT,
    "id_grade_2" TEXT,
    "id_grade_3" TEXT,
    "referencias_grade" JSONB NOT NULL DEFAULT '[]',
    "sincronizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "produtos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "produtos_id_externo_erp_key" ON "produtos"("id_externo_erp");

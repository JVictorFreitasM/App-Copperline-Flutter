/*
  Warnings:

  - You are about to drop the column `api_key` on the `configuracao_llm` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "configuracao_orcamento" ADD COLUMN     "permitir_itens_repetidos" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "chaves_llm" (
    "id" TEXT NOT NULL,
    "rotulo" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chaves_llm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chaves_llm_ativa_ordem_idx" ON "chaves_llm"("ativa", "ordem");

-- DataMigration: migra a chave ja configurada (se houver) de
-- configuracao_llm.api_key pra uma linha em chaves_llm, ANTES de derrubar a
-- coluna - sem isso, quem ja tinha uma chave cifrada configurada perderia o
-- acesso ao LLM silenciosamente nesta migracao (2026-09-24, suporte a
-- multiplas chaves com fallback).
INSERT INTO "chaves_llm" ("id", "rotulo", "api_key", "ordem", "ativa", "criado_em", "atualizado_em")
SELECT gen_random_uuid(), 'Chave migrada', "api_key", 0, true, "atualizado_em", "atualizado_em"
FROM "configuracao_llm"
WHERE "api_key" IS NOT NULL;

-- AlterTable
ALTER TABLE "configuracao_llm" DROP COLUMN "api_key";

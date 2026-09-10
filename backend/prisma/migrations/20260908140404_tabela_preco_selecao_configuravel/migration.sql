-- AlterTable
ALTER TABLE "tabelas_preco" DROP COLUMN "padrao";

-- CreateTable
CREATE TABLE "configuracao_tabela_preco" (
    "id" TEXT NOT NULL,
    "codigo_selecionado" TEXT,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracao_tabela_preco_pkey" PRIMARY KEY ("id")
);

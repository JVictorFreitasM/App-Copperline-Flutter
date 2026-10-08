-- CreateEnum
CREATE TYPE "tipo_provedor_api" AS ENUM ('CEP', 'CNPJ', 'GEOCODIFICACAO');

-- CreateTable
CREATE TABLE "provedores_api" (
    "id" TEXT NOT NULL,
    "tipo" "tipo_provedor_api" NOT NULL,
    "formato" TEXT NOT NULL,
    "rotulo" TEXT NOT NULL,
    "url_base" TEXT NOT NULL,
    "token" TEXT,
    "limite_requisicoes" INTEGER,
    "janela_segundos" INTEGER,
    "ordem" INTEGER NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provedores_api_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "provedores_api_tipo_ordem_idx" ON "provedores_api"("tipo", "ordem");

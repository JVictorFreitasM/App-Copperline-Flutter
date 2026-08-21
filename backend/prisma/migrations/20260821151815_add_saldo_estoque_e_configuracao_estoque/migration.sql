-- CreateTable
CREATE TABLE "saldos_estoque" (
    "id" TEXT NOT NULL,
    "codigo_produto" TEXT NOT NULL,
    "quantidade_disponivel" DECIMAL(18,6) NOT NULL,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saldos_estoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracao_estoque" (
    "id" TEXT NOT NULL,
    "intervalo_sincronizacao_minutos" INTEGER NOT NULL DEFAULT 30,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracao_estoque_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "saldos_estoque_codigo_produto_key" ON "saldos_estoque"("codigo_produto");

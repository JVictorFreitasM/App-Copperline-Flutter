-- CreateTable
CREATE TABLE "tabelas_preco" (
    "id" TEXT NOT NULL,
    "id_externo_erp" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "padrao" BOOLEAN NOT NULL DEFAULT false,
    "sincronizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tabelas_preco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_tabela_preco" (
    "id" TEXT NOT NULL,
    "tabela_preco_id" TEXT NOT NULL,
    "codigo_item" TEXT NOT NULL,
    "preco" DECIMAL(18,6) NOT NULL,
    "precoPromocional" DECIMAL(18,6),
    "quantidadeMinima" DECIMAL(20,4) NOT NULL,
    "quantidadeMaxima" DECIMAL(20,4) NOT NULL,
    "percentualDescontoMaximo" DECIMAL(5,2) NOT NULL,
    "valorDescontoMaximo" DECIMAL(18,6) NOT NULL,
    "data_ultimo_reajuste" TIMESTAMP(3),
    "data_inicio_promocao" TIMESTAMP(3),
    "data_fim_promocao" TIMESTAMP(3),

    CONSTRAINT "itens_tabela_preco_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tabelas_preco_id_externo_erp_key" ON "tabelas_preco"("id_externo_erp");

-- CreateIndex
CREATE UNIQUE INDEX "tabelas_preco_codigo_key" ON "tabelas_preco"("codigo");

-- CreateIndex
CREATE INDEX "itens_tabela_preco_codigo_item_idx" ON "itens_tabela_preco"("codigo_item");

-- CreateIndex
CREATE UNIQUE INDEX "itens_tabela_preco_tabela_preco_id_codigo_item_key" ON "itens_tabela_preco"("tabela_preco_id", "codigo_item");

-- AddForeignKey
ALTER TABLE "itens_tabela_preco" ADD CONSTRAINT "itens_tabela_preco_tabela_preco_id_fkey" FOREIGN KEY ("tabela_preco_id") REFERENCES "tabelas_preco"("id") ON DELETE CASCADE ON UPDATE CASCADE;

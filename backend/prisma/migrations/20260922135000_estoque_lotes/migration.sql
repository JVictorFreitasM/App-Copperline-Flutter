-- CreateTable
CREATE TABLE "estoque_lotes" (
    "id" TEXT NOT NULL,
    "codigo_produto" TEXT NOT NULL,
    "lote" TEXT NOT NULL DEFAULT '',
    "local_codigo" TEXT NOT NULL,
    "local_nome" TEXT NOT NULL,
    "quantidade" DECIMAL(18,6) NOT NULL,
    "fabricado_em" TIMESTAMP(3),
    "sincronizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estoque_lotes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "estoque_lotes_codigo_produto_lote_local_codigo_key" ON "estoque_lotes"("codigo_produto", "lote", "local_codigo");

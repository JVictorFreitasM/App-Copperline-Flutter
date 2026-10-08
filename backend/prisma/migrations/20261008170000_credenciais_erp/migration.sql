-- CreateTable
CREATE TABLE "credenciais_erp" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "valor_cifrado" TEXT NOT NULL,
    "atualizado_por_sub" TEXT,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credenciais_erp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "credenciais_erp_chave_key" ON "credenciais_erp"("chave");

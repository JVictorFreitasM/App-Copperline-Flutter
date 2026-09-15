-- CreateTable
CREATE TABLE "clientes_tabelas_preco" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "tabela_preco_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clientes_tabelas_preco_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clientes_tabelas_preco_tabela_preco_id_idx" ON "clientes_tabelas_preco"("tabela_preco_id");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_tabelas_preco_cliente_id_tabela_preco_id_key" ON "clientes_tabelas_preco"("cliente_id", "tabela_preco_id");

-- AddForeignKey
ALTER TABLE "clientes_tabelas_preco" ADD CONSTRAINT "clientes_tabelas_preco_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes_tabelas_preco" ADD CONSTRAINT "clientes_tabelas_preco_tabela_preco_id_fkey" FOREIGN KEY ("tabela_preco_id") REFERENCES "tabelas_preco"("id") ON DELETE CASCADE ON UPDATE CASCADE;

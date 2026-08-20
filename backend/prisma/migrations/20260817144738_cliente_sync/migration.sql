-- AlterTable
ALTER TABLE "sync_entities" ADD COLUMN     "ultima_sincronizacao" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "id_externo_erp" TEXT NOT NULL,
    "codigo_integrador" TEXT,
    "cpf_cnpj" TEXT,
    "razao_social" TEXT,
    "nome_fantasia" TEXT,
    "inativo" BOOLEAN NOT NULL DEFAULT false,
    "enderecos" JSONB NOT NULL DEFAULT '[]',
    "sincronizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contatos_clientes" (
    "id" TEXT NOT NULL,
    "id_externo_erp" TEXT NOT NULL,
    "codigo_integrador" TEXT,
    "cliente_id" TEXT NOT NULL,
    "nome" TEXT,
    "email" TEXT,
    "telefone_ddd" TEXT,
    "telefone_numero" TEXT,
    "funcao" TEXT,
    "sincronizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contatos_clientes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clientes_id_externo_erp_key" ON "clientes"("id_externo_erp");

-- CreateIndex
CREATE UNIQUE INDEX "contatos_clientes_id_externo_erp_key" ON "contatos_clientes"("id_externo_erp");

-- CreateIndex
CREATE INDEX "contatos_clientes_cliente_id_idx" ON "contatos_clientes"("cliente_id");

-- AddForeignKey
ALTER TABLE "contatos_clientes" ADD CONSTRAINT "contatos_clientes_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

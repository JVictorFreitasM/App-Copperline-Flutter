-- CreateEnum
CREATE TYPE "tipo_situacao_pedido" AS ENUM ('EM_ANALISE', 'BLOQUEADO', 'PENDENTE', 'CANCELADO', 'PARCIALMENTE_FATURADO', 'FATURADO', 'PARCIALMENTE_ATENDIDO', 'ATENDIDO');

-- CreateEnum
CREATE TYPE "situacao_item_pedido" AS ENUM ('NENHUM', 'CANCELADO', 'FATURADO', 'PARCIALMENTE_FATURADO', 'ATENDIDO', 'PARCIALMENTE_ATENDIDO', 'PENDENTE');

-- AlterTable
ALTER TABLE "clientes" ADD COLUMN     "incompleto" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "produtos" ADD COLUMN     "incompleto" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "pedidos" (
    "id" TEXT NOT NULL,
    "id_externo_erp" TEXT NOT NULL,
    "codigo_integrador" TEXT,
    "numero" TEXT,
    "situacao" "tipo_situacao_pedido",
    "data_hora_ultima_alteracao" TIMESTAMP(3),
    "cliente_id" TEXT,
    "valor_total" DECIMAL(18,6),
    "sincronizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedido_itens" (
    "id" TEXT NOT NULL,
    "pedido_id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "produto_id" TEXT,
    "id_item_grade_1" TEXT,
    "id_item_grade_2" TEXT,
    "id_item_grade_3" TEXT,
    "quantidade_venda" DECIMAL(18,6),
    "valor_unitario" DECIMAL(18,6),
    "valor_total" DECIMAL(18,6),
    "situacao" "situacao_item_pedido",
    "sincronizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pedido_itens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_id_externo_erp_key" ON "pedidos"("id_externo_erp");

-- CreateIndex
CREATE INDEX "pedidos_cliente_id_idx" ON "pedidos"("cliente_id");

-- CreateIndex
CREATE INDEX "pedido_itens_produto_id_idx" ON "pedido_itens"("produto_id");

-- CreateIndex
CREATE UNIQUE INDEX "pedido_itens_pedido_id_numero_key" ON "pedido_itens"("pedido_id", "numero");

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_itens" ADD CONSTRAINT "pedido_itens_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_itens" ADD CONSTRAINT "pedido_itens_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

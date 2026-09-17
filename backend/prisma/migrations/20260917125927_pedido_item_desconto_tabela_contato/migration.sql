-- AlterTable
ALTER TABLE "contatos_clientes" ADD COLUMN     "criado_localmente" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "pedido_itens" ADD COLUMN     "observacoes" TEXT,
ADD COLUMN     "percentual_desconto" DECIMAL(5,2),
ADD COLUMN     "valor_unitario_bruto" DECIMAL(18,6);

-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN     "codigo_tabela_preco" TEXT,
ADD COLUMN     "contato_id" TEXT;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_contato_id_fkey" FOREIGN KEY ("contato_id") REFERENCES "contatos_clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

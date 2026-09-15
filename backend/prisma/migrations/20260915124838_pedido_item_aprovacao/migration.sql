-- CreateEnum
CREATE TYPE "status_aprovacao_item_pedido" AS ENUM ('PENDENTE', 'APROVADO', 'REJEITADO');

-- AlterTable
ALTER TABLE "pedido_itens" ADD COLUMN     "decidido_em" TIMESTAMP(3),
ADD COLUMN     "decidido_por_id" TEXT,
ADD COLUMN     "status_aprovacao" "status_aprovacao_item_pedido" NOT NULL DEFAULT 'PENDENTE';

-- AddForeignKey
ALTER TABLE "pedido_itens" ADD CONSTRAINT "pedido_itens_decidido_por_id_fkey" FOREIGN KEY ("decidido_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

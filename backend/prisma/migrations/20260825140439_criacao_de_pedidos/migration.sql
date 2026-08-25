-- CreateEnum
CREATE TYPE "status_pedido_local" AS ENUM ('AGUARDANDO_APROVACAO', 'ENVIADO');

-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN     "percentual_desconto_solicitado" DECIMAL(5,2),
ADD COLUMN     "status_local" "status_pedido_local",
ADD COLUMN     "vendedor_id" TEXT,
ALTER COLUMN "id_externo_erp" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "vendedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

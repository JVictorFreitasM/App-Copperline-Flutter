-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN     "vendedor_radar_id" TEXT;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_vendedor_radar_id_fkey" FOREIGN KEY ("vendedor_radar_id") REFERENCES "vendedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

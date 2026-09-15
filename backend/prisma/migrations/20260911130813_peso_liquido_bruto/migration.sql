-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN     "peso_bruto_total_kg" DECIMAL(14,3),
ADD COLUMN     "peso_liquido_total_kg" DECIMAL(14,3);

-- AlterTable
ALTER TABLE "produtos" ADD COLUMN     "peso_bruto_kg" DECIMAL(12,3),
ADD COLUMN     "peso_liquido_kg" DECIMAL(12,3);

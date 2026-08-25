-- CreateEnum
CREATE TYPE "tipo_venda_produto" AS ENUM ('POC', 'RET', 'KM');

-- AlterTable
ALTER TABLE "produtos" ADD COLUMN     "comprimento_metros" DECIMAL(10,3),
ADD COLUMN     "tipo_venda" "tipo_venda_produto";

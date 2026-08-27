-- AlterTable
ALTER TABLE "clientes" ADD COLUMN     "data_limite_credito" TIMESTAMP(3),
ADD COLUMN     "limite_credito" DECIMAL(14,2);

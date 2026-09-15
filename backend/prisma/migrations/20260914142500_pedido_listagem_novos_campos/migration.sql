-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN     "data_emissao" TIMESTAMP(3),
ADD COLUMN     "previsao_faturamento" TIMESTAMP(3),
ADD COLUMN     "uf_entrega" VARCHAR(2);

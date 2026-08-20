-- CreateEnum
CREATE TYPE "tipo_nota_fiscal" AS ENUM ('ENTRADA', 'SAIDA');

-- CreateEnum
CREATE TYPE "status_nfe" AS ENUM ('ERRO_VALIDACAO', 'AGUARDANDO_AUTORIZACAO', 'AUTORIZADA', 'DENEGADA', 'REJEITADA', 'CANCELADA', 'INUTILIZADA');

-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN     "incompleto" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "notas_fiscais" (
    "id" TEXT NOT NULL,
    "id_externo_erp" TEXT NOT NULL,
    "codigo_integrador" TEXT,
    "chave" TEXT,
    "tipo" "tipo_nota_fiscal",
    "numero" INTEGER,
    "serie" TEXT,
    "data_emissao" TIMESTAMP(3),
    "status_nfe" "status_nfe",
    "nfse_gerada" BOOLEAN,
    "nfse_cancelada" BOOLEAN,
    "valor_total_nota_fiscal" DECIMAL(18,6),
    "sincronizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notas_fiscais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nota_fiscal_pedidos" (
    "nota_fiscal_id" TEXT NOT NULL,
    "pedido_id" TEXT NOT NULL,

    CONSTRAINT "nota_fiscal_pedidos_pkey" PRIMARY KEY ("nota_fiscal_id","pedido_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notas_fiscais_id_externo_erp_key" ON "notas_fiscais"("id_externo_erp");

-- CreateIndex
CREATE UNIQUE INDEX "notas_fiscais_chave_key" ON "notas_fiscais"("chave");

-- CreateIndex
CREATE INDEX "nota_fiscal_pedidos_pedido_id_idx" ON "nota_fiscal_pedidos"("pedido_id");

-- AddForeignKey
ALTER TABLE "nota_fiscal_pedidos" ADD CONSTRAINT "nota_fiscal_pedidos_nota_fiscal_id_fkey" FOREIGN KEY ("nota_fiscal_id") REFERENCES "notas_fiscais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nota_fiscal_pedidos" ADD CONSTRAINT "nota_fiscal_pedidos_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "papel_vendedor" AS ENUM ('VENDEDOR', 'SUPERVISOR', 'GERENTE');

-- CreateEnum
CREATE TYPE "status_solicitacao_desconto" AS ENUM ('PENDENTE', 'APROVADO', 'REJEITADO');

-- AlterTable
ALTER TABLE "vendedores" ADD COLUMN     "papel" "papel_vendedor" NOT NULL DEFAULT 'VENDEDOR',
ADD COLUMN     "supervisor_id" TEXT;

-- CreateTable
CREATE TABLE "configuracao_desconto" (
    "id" TEXT NOT NULL,
    "limite_percentual" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracao_desconto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitacoes_desconto" (
    "id" TEXT NOT NULL,
    "pedido_id" TEXT,
    "percentual_solicitado" DECIMAL(5,2) NOT NULL,
    "vendedor_solicitante_id" TEXT NOT NULL,
    "papel_exigido" "papel_vendedor" NOT NULL,
    "aprovador_esperado_id" TEXT,
    "status" "status_solicitacao_desconto" NOT NULL DEFAULT 'PENDENTE',
    "aprovador_id" TEXT,
    "decidido_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitacoes_desconto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "solicitacoes_desconto_vendedor_solicitante_id_idx" ON "solicitacoes_desconto"("vendedor_solicitante_id");

-- CreateIndex
CREATE INDEX "solicitacoes_desconto_status_idx" ON "solicitacoes_desconto"("status");

-- AddForeignKey
ALTER TABLE "vendedores" ADD CONSTRAINT "vendedores_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "vendedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes_desconto" ADD CONSTRAINT "solicitacoes_desconto_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes_desconto" ADD CONSTRAINT "solicitacoes_desconto_vendedor_solicitante_id_fkey" FOREIGN KEY ("vendedor_solicitante_id") REFERENCES "vendedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes_desconto" ADD CONSTRAINT "solicitacoes_desconto_aprovador_esperado_id_fkey" FOREIGN KEY ("aprovador_esperado_id") REFERENCES "vendedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes_desconto" ADD CONSTRAINT "solicitacoes_desconto_aprovador_id_fkey" FOREIGN KEY ("aprovador_id") REFERENCES "vendedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

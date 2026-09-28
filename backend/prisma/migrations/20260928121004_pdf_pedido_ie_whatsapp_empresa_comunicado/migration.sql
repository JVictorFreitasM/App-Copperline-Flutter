-- AlterTable
ALTER TABLE "clientes" ADD COLUMN     "inscricao_estadual" TEXT;

-- AlterTable
ALTER TABLE "vendedores" ADD COLUMN     "whatsapp" TEXT;

-- CreateTable
CREATE TABLE "dados_empresa_pdf" (
    "id" TEXT NOT NULL,
    "razao_social" TEXT NOT NULL DEFAULT '',
    "cnpj" TEXT NOT NULL DEFAULT '',
    "endereco" TEXT NOT NULL DEFAULT '',
    "cep" TEXT NOT NULL DEFAULT '',
    "telefone" TEXT NOT NULL DEFAULT '',
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dados_empresa_pdf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comunicado_pedido_pdf" (
    "id" TEXT NOT NULL,
    "texto" TEXT NOT NULL DEFAULT '',
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comunicado_pedido_pdf_pkey" PRIMARY KEY ("id")
);

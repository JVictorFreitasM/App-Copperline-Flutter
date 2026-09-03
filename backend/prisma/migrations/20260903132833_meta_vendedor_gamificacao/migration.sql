-- CreateTable
CREATE TABLE "metas_vendedor" (
    "id" TEXT NOT NULL,
    "vendedor_id" TEXT NOT NULL,
    "mes_ano" TEXT NOT NULL,
    "valor_meta" DECIMAL(18,6) NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metas_vendedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracao_gamificacao" (
    "id" TEXT NOT NULL,
    "ranking_visivel_para_vendedor" BOOLEAN NOT NULL DEFAULT false,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracao_gamificacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "metas_vendedor_vendedor_id_mes_ano_key" ON "metas_vendedor"("vendedor_id", "mes_ano");

-- AddForeignKey
ALTER TABLE "metas_vendedor" ADD CONSTRAINT "metas_vendedor_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "vendedores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

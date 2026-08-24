-- DropTable
DROP TABLE "configuracao_estoque";

-- CreateEnum
CREATE TYPE "tipo_cadencia_sync" AS ENUM ('INCREMENTAL', 'INCREMENTAL_NOTURNO', 'JANELA_FIXA_DIARIA', 'CONFIGURAVEL');

-- CreateTable
CREATE TABLE "configuracao_sync" (
    "id" TEXT NOT NULL,
    "nome_entidade" TEXT NOT NULL,
    "tipo_cadencia" "tipo_cadencia_sync" NOT NULL,
    "intervalo_minutos" INTEGER,
    "horario_fixo" TEXT,
    "dias_semana" INTEGER[],
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracao_sync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "configuracao_sync_nome_entidade_key" ON "configuracao_sync"("nome_entidade");

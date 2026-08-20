-- CreateEnum
CREATE TYPE "sync_log_status" AS ENUM ('EM_ANDAMENTO', 'SUCESSO', 'ERRO');

-- CreateTable
CREATE TABLE "sync_entities" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" TEXT NOT NULL,
    "sync_entity_id" TEXT NOT NULL,
    "status" "sync_log_status" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "iniciado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizado_em" TIMESTAMP(3),
    "registros_processados" INTEGER NOT NULL DEFAULT 0,
    "registros_com_erro" INTEGER NOT NULL DEFAULT 0,
    "erro" JSONB,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sync_entities_nome_key" ON "sync_entities"("nome");

-- CreateIndex
CREATE INDEX "sync_logs_sync_entity_id_idx" ON "sync_logs"("sync_entity_id");

-- AddForeignKey
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_sync_entity_id_fkey" FOREIGN KEY ("sync_entity_id") REFERENCES "sync_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

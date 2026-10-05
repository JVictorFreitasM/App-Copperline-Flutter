-- CreateEnum
CREATE TYPE "destino_mensagem" AS ENUM ('TODOS', 'VENDEDOR', 'GRUPO');

-- AlterEnum
ALTER TYPE "tipo_evento_notificacao" ADD VALUE IF NOT EXISTS 'MENSAGEM_DIRETA';

-- CreateTable
CREATE TABLE "grupos_mensagem" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grupos_mensagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grupos_mensagem_membros" (
    "grupo_id" TEXT NOT NULL,
    "vendedor_id" TEXT NOT NULL,

    CONSTRAINT "grupos_mensagem_membros_pkey" PRIMARY KEY ("grupo_id","vendedor_id")
);

-- CreateTable
CREATE TABLE "mensagens_notificacao" (
    "id" TEXT NOT NULL,
    "autor_id" TEXT NOT NULL,
    "destino" "destino_mensagem" NOT NULL,
    "vendedor_id" TEXT,
    "grupo_id" TEXT,
    "assunto" TEXT NOT NULL,
    "corpo" TEXT NOT NULL,
    "total_destinatarios" INTEGER NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensagens_notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "grupos_mensagem_nome_key" ON "grupos_mensagem"("nome");

-- CreateIndex
CREATE INDEX "grupos_mensagem_membros_vendedor_id_idx" ON "grupos_mensagem_membros"("vendedor_id");

-- CreateIndex
CREATE INDEX "mensagens_notificacao_criado_em_idx" ON "mensagens_notificacao"("criado_em");

-- AddForeignKey
ALTER TABLE "grupos_mensagem_membros" ADD CONSTRAINT "grupos_mensagem_membros_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos_mensagem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupos_mensagem_membros" ADD CONSTRAINT "grupos_mensagem_membros_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "vendedores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens_notificacao" ADD CONSTRAINT "mensagens_notificacao_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens_notificacao" ADD CONSTRAINT "mensagens_notificacao_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "vendedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens_notificacao" ADD CONSTRAINT "mensagens_notificacao_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos_mensagem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

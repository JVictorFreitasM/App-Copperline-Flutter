-- CreateEnum
CREATE TYPE "frequencia_mensagem" AS ENUM ('DIARIA', 'DIAS_UTEIS', 'SEMANAL', 'MENSAL');

-- AlterTable
ALTER TABLE "mensagens_notificacao" ADD COLUMN     "periodica_id" TEXT;

-- CreateTable
CREATE TABLE "mensagens_periodicas" (
    "id" TEXT NOT NULL,
    "autor_id" TEXT NOT NULL,
    "destino" "destino_mensagem" NOT NULL,
    "vendedor_id" TEXT,
    "grupo_id" TEXT,
    "assunto" TEXT NOT NULL,
    "corpo" TEXT NOT NULL,
    "frequencia" "frequencia_mensagem" NOT NULL,
    "horario" TEXT NOT NULL,
    "dia_semana" INTEGER,
    "dia_mes" INTEGER,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "proximo_envio_em" TIMESTAMP(3) NOT NULL,
    "ultimo_envio_em" TIMESTAMP(3),
    "ultimo_erro" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mensagens_periodicas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mensagens_periodicas_ativa_proximo_envio_em_idx" ON "mensagens_periodicas"("ativa", "proximo_envio_em");

-- AddForeignKey
ALTER TABLE "mensagens_notificacao" ADD CONSTRAINT "mensagens_notificacao_periodica_id_fkey" FOREIGN KEY ("periodica_id") REFERENCES "mensagens_periodicas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens_periodicas" ADD CONSTRAINT "mensagens_periodicas_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens_periodicas" ADD CONSTRAINT "mensagens_periodicas_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "vendedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens_periodicas" ADD CONSTRAINT "mensagens_periodicas_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos_mensagem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

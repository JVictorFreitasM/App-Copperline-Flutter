-- CreateTable
CREATE TABLE "notificacoes_usuario" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "evento_id" TEXT NOT NULL,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "lida_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacoes_usuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notificacoes_usuario_usuario_id_lida_criado_em_idx" ON "notificacoes_usuario"("usuario_id", "lida", "criado_em");

-- CreateIndex
CREATE UNIQUE INDEX "notificacoes_usuario_usuario_id_evento_id_key" ON "notificacoes_usuario"("usuario_id", "evento_id");

-- AddForeignKey
ALTER TABLE "notificacoes_usuario" ADD CONSTRAINT "notificacoes_usuario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes_usuario" ADD CONSTRAINT "notificacoes_usuario_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "eventos_notificacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

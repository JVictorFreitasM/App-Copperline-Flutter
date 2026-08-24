-- CreateEnum
CREATE TYPE "plataforma_dispositivo" AS ENUM ('ANDROID', 'IOS', 'WEB');

-- CreateEnum
CREATE TYPE "tipo_evento_notificacao" AS ENUM ('PEDIDO_SITUACAO_ALTERADA', 'NOTA_FISCAL_REJEITADA', 'PRODUTO_REABASTECIDO');

-- CreateEnum
CREATE TYPE "status_evento_notificacao" AS ENUM ('PENDENTE', 'ENVIADO', 'ERRO');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "sub" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispositivos_usuario" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "plataforma" "plataforma_dispositivo" NOT NULL,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispositivos_usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produtos_favoritos" (
    "usuario_id" TEXT NOT NULL,
    "produto_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "produtos_favoritos_pkey" PRIMARY KEY ("usuario_id","produto_id")
);

-- CreateTable
CREATE TABLE "eventos_notificacao" (
    "id" TEXT NOT NULL,
    "tipo" "tipo_evento_notificacao" NOT NULL,
    "referencia_id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "corpo" TEXT NOT NULL,
    "dados" JSONB,
    "status" "status_evento_notificacao" NOT NULL DEFAULT 'PENDENTE',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processado_em" TIMESTAMP(3),
    "erro" JSONB,

    CONSTRAINT "eventos_notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_sub_key" ON "usuarios"("sub");

-- CreateIndex
CREATE UNIQUE INDEX "dispositivos_usuario_token_key" ON "dispositivos_usuario"("token");

-- CreateIndex
CREATE INDEX "dispositivos_usuario_usuario_id_idx" ON "dispositivos_usuario"("usuario_id");

-- CreateIndex
CREATE INDEX "eventos_notificacao_status_idx" ON "eventos_notificacao"("status");

-- AddForeignKey
ALTER TABLE "dispositivos_usuario" ADD CONSTRAINT "dispositivos_usuario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produtos_favoritos" ADD CONSTRAINT "produtos_favoritos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produtos_favoritos" ADD CONSTRAINT "produtos_favoritos_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

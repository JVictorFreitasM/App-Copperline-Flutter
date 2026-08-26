-- CreateEnum
CREATE TYPE "tipo_acao_fila" AS ENUM ('CRIAR_PEDIDO', 'CHECKIN_VISITA', 'CHECKOUT_VISITA', 'CANCELAR_VISITA', 'RASTREIO_LOTE');

-- CreateEnum
CREATE TYPE "status_acao_fila" AS ENUM ('SUCESSO', 'ERRO');

-- CreateTable
CREATE TABLE "acoes_fila_processadas" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "id_local" TEXT NOT NULL,
    "tipo" "tipo_acao_fila" NOT NULL,
    "status" "status_acao_fila" NOT NULL,
    "resultado" JSONB,
    "erro" TEXT,
    "processado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acoes_fila_processadas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "acoes_fila_processadas_usuario_id_id_local_key" ON "acoes_fila_processadas"("usuario_id", "id_local");

-- AddForeignKey
ALTER TABLE "acoes_fila_processadas" ADD CONSTRAINT "acoes_fila_processadas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

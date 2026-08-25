-- CreateTable
CREATE TABLE "localizacoes_usuario" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "capturado_em" TIMESTAMP(3) NOT NULL,
    "lote_id" TEXT NOT NULL,
    "recebido_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "localizacoes_usuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "localizacoes_usuario_usuario_id_capturado_em_idx" ON "localizacoes_usuario"("usuario_id", "capturado_em");

-- AddForeignKey
ALTER TABLE "localizacoes_usuario" ADD CONSTRAINT "localizacoes_usuario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

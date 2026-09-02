-- CreateTable
CREATE TABLE "documentos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "caminho_arquivo" TEXT NOT NULL,
    "tipo_mime" TEXT NOT NULL,
    "tamanho_bytes" INTEGER NOT NULL,
    "enviado_por_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documentos_categoria_idx" ON "documentos"("categoria");

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_enviado_por_id_fkey" FOREIGN KEY ("enviado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

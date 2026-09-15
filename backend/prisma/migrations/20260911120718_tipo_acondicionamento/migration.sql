-- AlterTable
ALTER TABLE "produtos" ADD COLUMN     "tipo_acondicionamento_id" TEXT;

-- CreateTable
CREATE TABLE "tipos_acondicionamento" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipos_acondicionamento_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_tipo_acondicionamento_id_fkey" FOREIGN KEY ("tipo_acondicionamento_id") REFERENCES "tipos_acondicionamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
